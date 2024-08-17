import {
  getBase58Encoder,
  lamports,
  type Address,
  type LamportsUnsafeBeyond2Pow53Minus1,
  type Signature,
} from "@solana/web3.js";
import {
  getCreateAccountInstructionDataDecoder,
  identifySystemInstruction,
  SYSTEM_PROGRAM_ADDRESS,
  SystemInstruction,
} from "@solana-program/system";

import type { GetTransactionHistoryResponse } from "./rpc/get-transaction-history";

type TransactionEvent =
  | { kind: "received_sol"; lamports: bigint; from: Address[] }
  | { kind: "sent_sol"; lamports: bigint; to: Address[] }
  | { kind: "received_token"; mint: Address; uiAmount: number; from: Address[] }
  | { kind: "sent_token"; mint: Address; uiAmount: number; to: Address[] }
  | { kind: "received_nft"; assetId: Address; from?: Address }
  | { kind: "sent_nft"; assetId: Address; to: Address };

type ParsedHistoryTransaction = GetTransactionHistoryResponse[0];

const knownApps = {
  EXCHANGE_ART: "Exchange Art",
  SOLANART: "Solanart",
  MAGIC_EDEN: "Magic Eden",
  HYPERSPACE: "Hyperspace",
  TENSOR: "Tensor",
  JUPITER: "Jupiter",
  METAPLEX: "Metaplex",
  RAYDIUM: "Raydium",
} as const;

// This checks the keys in `knownApps` are valid sources
type _ParsedHistoryTransactionSourceMapping = {
  [K in ParsedHistoryTransaction["source"]]: (typeof knownApps)[K];
};

type KnownAppNames = (typeof knownApps)[keyof typeof knownApps];

export type TransactionSummary = Readonly<{
  success: boolean;
  feePayer: Address;
  signature: Signature;
  knownApp?: KnownAppNames;
  timestamp: number;
  events: readonly TransactionEvent[];
}>;

const createAccountInstructionDataDecoder =
  getCreateAccountInstructionDataDecoder();

type RentCosts = { [address: Address]: LamportsUnsafeBeyond2Pow53Minus1 };

// Parse instructions + inner instructions for System program Create Account instructions
// Get a map of new account -> lamports used for rent
function getNewAccountRentCosts(
  instructions: ParsedHistoryTransaction["instructions"]
): RentCosts {
  const newAccountRentCosts: {
    [address: Address]: LamportsUnsafeBeyond2Pow53Minus1;
  } = {};

  const flattenedInstructions = [
    ...instructions,
    ...instructions.flatMap((i) => i.innerInstructions),
  ];

  for (const instruction of flattenedInstructions) {
    if (instruction.programId === SYSTEM_PROGRAM_ADDRESS) {
      const data = getBase58Encoder().encode(instruction.data);
      // TODO: Next version of generated clients will remove this cast: https://github.com/kinobi-so/kinobi/pull/138
      const instructionType = identifySystemInstruction(data as Uint8Array);
      if (instructionType === SystemInstruction.CreateAccount) {
        const decodedData = createAccountInstructionDataDecoder.decode(data);
        // second account of this instruction is the created account
        // note we don't use parse because we don't have an IInstruction object
        newAccountRentCosts[instruction.accounts[1]] =
          decodedData.lamports as LamportsUnsafeBeyond2Pow53Minus1;
      }
    }
  }

  return newAccountRentCosts;
}

export function summariseParsedTransaction(
  transaction: ParsedHistoryTransaction,
  forAddress: Address
): TransactionSummary {
  const knownApp = knownApps[transaction.source];

  // Group all SOL sent/received
  let totalSentSol: LamportsUnsafeBeyond2Pow53Minus1 = lamports(0n);
  let totalReceivedSol: LamportsUnsafeBeyond2Pow53Minus1 = lamports(0n);

  // Group events using the same mint
  // We use number because Helius' API provides floats which may not be integers
  // just accept slight errors from float math for this use case
  const fungibleTokenTransfers: {
    [mintAddress: Address]: {
      amount: number;
      toAddresses: Address[];
      fromAddresses: Address[];
    };
  } = {};

  const events: TransactionEvent[] = [];

  for (const transfer of transaction.tokenTransfers) {
    if (transfer.fromUserAccount === forAddress && transfer.tokenAmount > 0) {
      if (transfer.tokenStandard === "Fungible") {
        fungibleTokenTransfers[transfer.mint] ??= {
          amount: 0,
          toAddresses: [],
          fromAddresses: [],
        };
        fungibleTokenTransfers[transfer.mint].amount -= transfer.tokenAmount;
        fungibleTokenTransfers[transfer.mint].toAddresses.push(
          transfer.toUserAccount
        );
      }
      if (
        transfer.tokenStandard === "NonFungible" ||
        transfer.tokenStandard === "ProgrammableNonFungible"
      ) {
        events.push({
          kind: "sent_nft",
          assetId: transfer.mint,
          to: transfer.toUserAccount,
        });
      }
    }
    if (transfer.toUserAccount === forAddress && transfer.tokenAmount > 0) {
      if (transfer.tokenStandard === "Fungible") {
        fungibleTokenTransfers[transfer.mint] ??= {
          amount: 0,
          toAddresses: [],
          fromAddresses: [],
        };
        fungibleTokenTransfers[transfer.mint].amount += transfer.tokenAmount;
        fungibleTokenTransfers[transfer.mint].fromAddresses.push(
          transfer.fromUserAccount
        );
      }
      if (
        transfer.tokenStandard === "NonFungible" ||
        transfer.tokenStandard === "ProgrammableNonFungible"
      ) {
        events.push({
          kind: "received_nft",
          assetId: transfer.mint,
          from: transfer.fromUserAccount,
        });
      }
    }
  }

  const newAccountRentCosts = getNewAccountRentCosts(transaction.instructions);
  const solSentToAddresses: Address[] = [];
  const solReceivedFromAddresses: Address[] = [];

  for (const transfer of transaction.nativeTransfers) {
    if (transfer.fromUserAccount === forAddress && transfer.amount > 0n) {
      const createAccountLamports =
        newAccountRentCosts[transfer.toUserAccount] ?? 0n;
      // remove rent from SOL transfers from the user
      // could go negative, which can't be converted to lamports
      const sentSolThisTransfer =
        totalSentSol + BigInt(transfer.amount) - createAccountLamports;
      totalSentSol =
        sentSolThisTransfer > 0n
          ? lamports(totalSentSol + sentSolThisTransfer)
          : totalSentSol;
      solSentToAddresses.push(transfer.toUserAccount);
    }
    if (transfer.toUserAccount === forAddress && transfer.amount > 0n) {
      totalReceivedSol = lamports(totalReceivedSol + BigInt(transfer.amount));
      solReceivedFromAddresses.push(transfer.fromUserAccount);
    }
  }

  if (totalSentSol > totalReceivedSol) {
    events.push({
      kind: "sent_sol",
      lamports: totalSentSol - totalReceivedSol,
      to: solSentToAddresses,
    });
  }
  if (totalReceivedSol > totalSentSol) {
    events.push({
      kind: "received_sol",
      lamports: totalReceivedSol - totalSentSol,
      from: solReceivedFromAddresses,
    });
  }

  for (const [mint, { amount, toAddresses, fromAddresses }] of Object.entries(
    fungibleTokenTransfers
  )) {
    if (amount > 0) {
      events.push({
        kind: "received_token",
        mint: mint as Address,
        uiAmount: amount,
        from: fromAddresses,
      });
    }
    if (amount < 0) {
      events.push({
        kind: "sent_token",
        mint: mint as Address,
        uiAmount: Math.abs(amount),
        to: toAddresses,
      });
    }
  }

  for (const event of transaction.events.compressed ?? []) {
    if (
      event.oldLeafOwner === forAddress &&
      event.newLeafOwner !== forAddress
    ) {
      events.push({
        kind: "sent_nft",
        assetId: event.assetId,
        to: event.newLeafOwner,
      });
    }
    if (
      event.newLeafOwner === forAddress &&
      event.oldLeafOwner !== forAddress
    ) {
      // We don't have access to an authority as part of compressed events
      // Use transaction fee payer if it is not the user address
      events.push({
        kind: "received_nft",
        assetId: event.assetId,
        from:
          transaction.feePayer !== forAddress
            ? transaction.feePayer
            : undefined,
      });
    }
  }

  return {
    success: true,
    feePayer: transaction.feePayer,
    signature: transaction.signature,
    knownApp,
    timestamp: transaction.timestamp,
    events,
  };
}
