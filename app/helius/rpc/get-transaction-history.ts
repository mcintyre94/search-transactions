import type {
  Address,
  Base64EncodedBytes,
  Signature,
  StringifiedNumber,
} from "@solana/web3.js";

// Note: typing here is not sophisticated or complete, only dealing with use cases we're concerned about
export type GetTransactionHistoryParams = Readonly<{
  address: Address;
  before?: Signature;
  commitment?: "confirmed" | "finalized";
  limit?: number;
}>;

type NativeTransfer = Readonly<{
  fromUserAccount: Address;
  toUserAccount: Address;
  amount: number;
}>;

type TokenTransfer = Readonly<{
  fromUserAccount: Address;
  toUserAccount: Address;
  fromTokenAccount: Address;
  toTokenAccount: Address;
  tokenAmount: number; // decimal number
  mint: Address;
  tokenStandard: "Fungible" | "NonFungible" | "ProgrammableNonFungible";
}>;

// Subset of Helius' list of sources, just the ones we want for activity for now
type ParsedTransactionSource =
  | "EXCHANGE_ART"
  | "SOLANART"
  | "MAGIC_EDEN"
  | "HYPERSPACE"
  | "TENSOR"
  | "JUPITER"
  | "METAPLEX"
  | "RAYDIUM";

type CompressedNftEvent = Readonly<{
  assetId: Address;
  oldLeafOwner: Address;
  newLeafOwner: Address;
}>;

type ParsedTransactionEvents = Readonly<{
  compressed?: readonly CompressedNftEvent[];
}>;

type BaseInstruction = Readonly<{
  accounts: readonly Address[];
  data: Base64EncodedBytes;
  programId: Address;
}>;

type TokenBalanceChange = Readonly<{
  userAccount: Address;
  tokenAccount: Address;
  rawTokenAmount: Readonly<{
    tokenAmount: StringifiedNumber;
    decimals: number;
  }>;
  mint: Address;
}>;

type AccountData = Readonly<{
  account: Address;
  nativeBalanceChange: number;
  tokenBalanceChanges: readonly TokenBalanceChange[];
}>;

type Instruction = BaseInstruction &
  Readonly<{
    innerInstructions: BaseInstruction[];
  }>;

type ParsedTransaction = Readonly<{
  description: string;
  source: ParsedTransactionSource;
  fee: number;
  feePayer: Address;
  signature: Signature;
  timestamp: number;
  nativeTransfers: readonly NativeTransfer[];
  tokenTransfers: readonly TokenTransfer[];
  accountData: readonly AccountData[];
  instructions: Instruction[];
  events: ParsedTransactionEvents;
}>;

export type GetTransactionHistoryResponse = readonly ParsedTransaction[];
