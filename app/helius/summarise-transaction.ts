import {
  address,
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
  | {
      kind: "received_token";
      mint: Address;
      unitAmount: bigint;
      decimals: number;
      from: Address[];
    }
  | {
      kind: "sent_token";
      mint: Address;
      unitAmount: bigint;
      decimals: number;
      to: Address[];
    }
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
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
  /*
  success: boolean;
  feePayer: Address;
  signature: Signature;
  knownApp?: KnownAppNames;
  timestamp: number;
  events: readonly TransactionEvent[];
  */

  /*
  | { kind: "received_sol"; lamports: bigint; from: Address[] }
  | { kind: "sent_sol"; lamports: bigint; to: Address[] }
  | { kind: "received_token"; mint: Address; uiAmount: number; from: Address[] }
  | { kind: "sent_token"; mint: Address; uiAmount: number; to: Address[] }
  | { kind: "received_nft"; assetId: Address; from?: Address }
  | { kind: "sent_nft"; assetId: Address; to: Address };
  */

  // Filter out low value SOL transfers, assuming they're likely rent transfers
  // Value of `getMinimumBalanceForRentExemption` for 200 bytes
  const minimumSolTransfer = 2282880;

  const events: TransactionEvent[] = [];

  const accountDataForAddress = transaction.accountData.find(
    (a) => a.account === forAddress
  );

  const feeForAddress =
    transaction.feePayer === forAddress ? transaction.fee : 0;

  const nativeBalanceChange = accountDataForAddress
    ? accountDataForAddress.nativeBalanceChange + feeForAddress
    : 0;

  const nativeBalanceChangeAbsLamports = lamports(
    BigInt(Math.abs(nativeBalanceChange))
  );

  if (nativeBalanceChangeAbsLamports > 0n) {
    // >= minimumSolTransfer
    if (nativeBalanceChange > 0) {
      // Received SOL
      let fromAddresses = transaction.nativeTransfers
        .filter(
          (t) => t.toUserAccount === forAddress // && t.amount > minimumSolTransfer
        )
        .map((t) => t.fromUserAccount);
      if (fromAddresses.length === 0) {
        // If no native transfers, check for account data matching the amount
        // Only works if there's exactly one transfer
        const matchingAccountData = transaction.accountData.find(
          (a) => a.nativeBalanceChange === -1 * nativeBalanceChange
        );
        if (matchingAccountData) {
          fromAddresses = [matchingAccountData.account];
        }
      }

      events.push({
        kind: "received_sol",
        lamports: nativeBalanceChangeAbsLamports,
        from: fromAddresses,
      });
    } else {
      // Sent SOL
      const rentAmounts = getNewAccountRentCosts(transaction.instructions);
      console.log({ signature: transaction.signature, rentAmounts });

      // If there's no rent transfers, the sent SOL is the balance change
      let rentAdjustedSentLamports = Number(nativeBalanceChangeAbsLamports);
      const toAddresses: Address[] = [];

      for (const transfer of transaction.nativeTransfers) {
        if (transfer.fromUserAccount === forAddress) {
          // filter out rent transfers
          if (BigInt(transfer.amount) === rentAmounts[transfer.toUserAccount]) {
            rentAdjustedSentLamports = Math.max(
              0,
              rentAdjustedSentLamports - transfer.amount
            );
          } else {
            toAddresses.push(transfer.toUserAccount);
          }
        }
      }

      if (rentAdjustedSentLamports > 0) {
        events.push({
          kind: "sent_sol",
          lamports: BigInt(rentAdjustedSentLamports),
          to: toAddresses,
        });
      }
    }
  }

  // Group transfers using the same mint
  const fungibleTokenTransfers: {
    [mintAddress: Address]: {
      unitAmount: number;
      decimals: number;
      toAddresses: Address[];
      fromAddresses: Address[];
    };
  } = {};

  // Get total token amounts sent/received
  for (const accountData of transaction.accountData) {
    for (const tokenBalanceChange of accountData.tokenBalanceChanges) {
      if (tokenBalanceChange.userAccount === forAddress) {
        const { tokenAmount, decimals } = tokenBalanceChange.rawTokenAmount;
        const existingTranfer = fungibleTokenTransfers[tokenBalanceChange.mint];
        if (existingTranfer) {
          existingTranfer.unitAmount += Number(tokenAmount);
        } else {
          fungibleTokenTransfers[tokenBalanceChange.mint] = {
            unitAmount: Number(tokenAmount),
            decimals,
            toAddresses: [],
            fromAddresses: [],
          };
        }
      }
    }
  }

  // Get to/from addresses for token transfers
  // Also create NFT events here
  for (const transfer of transaction.tokenTransfers) {
    if (transfer.tokenStandard === "Fungible") {
      const fungibleTokenTransfer = fungibleTokenTransfers[transfer.mint];
      if (fungibleTokenTransfer) {
        if (transfer.fromUserAccount === forAddress) {
          fungibleTokenTransfer.toAddresses.push(transfer.toUserAccount);
        }
        if (transfer.toUserAccount === forAddress) {
          fungibleTokenTransfer.fromAddresses.push(transfer.fromUserAccount);
        }
      }
    }
    if (
      transfer.tokenStandard === "NonFungible" ||
      transfer.tokenStandard === "ProgrammableNonFungible"
    ) {
      if (transfer.toUserAccount === forAddress) {
        events.push({
          kind: "received_nft",
          assetId: transfer.mint,
          from: transfer.fromUserAccount,
        });
      }
      if (transfer.fromUserAccount === forAddress) {
        events.push({
          kind: "sent_nft",
          assetId: transfer.mint,
          to: transfer.toUserAccount,
        });
      }
    }
  }

  for (const [mint, transfer] of Object.entries(fungibleTokenTransfers)) {
    if (transfer.unitAmount > 0) {
      events.push({
        kind: "received_token",
        mint: address(mint),
        unitAmount: BigInt(transfer.unitAmount),
        decimals: transfer.decimals,
        from: transfer.fromAddresses,
      });
    }
    if (transfer.unitAmount < 0) {
      events.push({
        kind: "sent_token",
        mint: address(mint),
        unitAmount: BigInt(Math.abs(transfer.unitAmount)),
        decimals: transfer.decimals,
        to: transfer.toAddresses,
      });
    }
  }

  // Get NFT transfers from compressed events
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

  const knownApp = knownApps[transaction.source];

  return {
    success: true,
    feePayer: transaction.feePayer,
    signature: transaction.signature,
    knownApp,
    timestamp: transaction.timestamp,
    events,
  };
}
