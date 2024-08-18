import { Address } from "@solana/web3.js";
import { TransactionSummary } from "~/helius/summarise-transaction";
import { AddressesData } from "~/queries/addressQueries";
import { AssetsData } from "~/queries/assetQueries";

type TimestampCondition = {
  gt?: number; // Greater than, in unix epoch seconds
  lt?: number; // Less than, in unix epoch seconds
};

type FungibleTokenCondition = {
  kind: "token";
  symbol: string; // Filter by token symbol (e.g. "BONK", "USDC"), case insensitive
};

type NFTCondition = {
  kind: "NFT";
  nameContains: string; // Partial match for NFT name, case insensitive
};

type AssetCondition = FungibleTokenCondition | NFTCondition;

type EventConditions = {
  kind?:
    | "received_sol"
    | "sent_sol"
    | "received_token"
    | "sent_token"
    | "received_nft"
    | "sent_nft";
  fromTag?: string; // Tag for the `from` address
  toTag?: string; // Tag for the `to` address
  assetCondition?: AssetCondition; // Asset conditions (symbol or address or nameContains)
};

type TransactionConditions = {
  forAddressTag?: string;
  timestamp?: TimestampCondition;
  knownApp?: TransactionSummary["knownApp"];
};

type FilterCondition =
  | { type: "event"; conditions: EventConditions }
  | { type: "transaction"; conditions: TransactionConditions };

export type Filter = FilterCondition[];

type TransactionEvent = TransactionSummary["events"][number];

function applyEventConditionKind(
  transactionEvent: TransactionEvent,
  kind: EventConditions["kind"]
): boolean {
  if (!kind) return true;
  return transactionEvent.kind === kind;
}

function applyEventConditionFromTag(
  transactionEvent: TransactionEvent,
  fromTag: EventConditions["fromTag"],
  addressesData: AddressesData,
  transactionFeePayer: Address
): boolean {
  if (!fromTag) return true;

  if (transactionEvent.kind === "received_nft") {
    if (!transactionEvent.from) {
      return false;
    }
    const fromData = addressesData[transactionEvent.from];
    if (!fromData) return false;
    return fromData.tags.some((t) => t.toLowerCase() === fromTag.toLowerCase());
  }

  if (
    transactionEvent.kind === "received_sol" ||
    transactionEvent.kind === "received_token"
  ) {
    if (transactionEvent.from.length === 0) {
      return false;
    }
    const fromDatas = transactionEvent.from.map((a) => addressesData[a]);
    return fromDatas.some(
      (d) => d && d.tags.some((t) => t.toLowerCase() === fromTag.toLowerCase())
    );
  }

  if (
    transactionEvent.kind === "sent_nft" ||
    transactionEvent.kind === "sent_sol" ||
    transactionEvent.kind === "sent_token"
  ) {
    // feePayer is from address
    const fromData = addressesData[transactionFeePayer];
    if (!fromData) return false;
    return fromData.tags.some((t) => t.toLowerCase() === fromTag.toLowerCase());
  }

  return false;
}

function applyEventConditionToTag(
  transactionEvent: TransactionEvent,
  toTag: EventConditions["toTag"],
  addressesData: AddressesData,
  transactionFeePayer: Address
): boolean {
  if (!toTag) return true;

  if (transactionEvent.kind === "sent_nft") {
    if (!transactionEvent.to) {
      return false;
    }
    const toData = addressesData[transactionEvent.to];
    if (!toData) return false;
    return toData.tags.some((t) => t.toLowerCase() === toTag.toLowerCase());
  }

  if (
    transactionEvent.kind === "sent_sol" ||
    transactionEvent.kind === "sent_token"
  ) {
    if (transactionEvent.to.length === 0) {
      return false;
    }
    const toDatas = transactionEvent.to.map((a) => addressesData[a]);
    return toDatas.some(
      (d) => d && d.tags.some((t) => t.toLowerCase() === toTag.toLowerCase())
    );
  }

  if (
    transactionEvent.kind === "received_nft" ||
    transactionEvent.kind === "received_sol" ||
    transactionEvent.kind === "received_token"
  ) {
    // fee payer is to address
    const toData = addressesData[transactionFeePayer];
    if (!toData) return false;
    return toData.tags.some((t) => t.toLowerCase() === toTag.toLowerCase());
  }

  return false;
}

function applyEventConditionAssetCondition(
  transactionEvent: TransactionEvent,
  assetCondition: EventConditions["assetCondition"],
  assetsData: AssetsData
): boolean {
  if (!assetCondition) return true;

  if (assetCondition.kind === "token") {
    if (
      transactionEvent.kind === "received_token" ||
      transactionEvent.kind === "sent_token"
    ) {
      const mintData = assetsData[transactionEvent.mint];
      if (!mintData) return false;
      if (mintData.kind !== "fungibleToken") return false;
      //   TODO: need to figure out why some tokens end up with undefined symbol
      if (!mintData.symbol) return false;
      return (
        mintData.symbol.toLowerCase() === assetCondition.symbol.toLowerCase()
      );
    }
    // any other transaction event kind won't involve the token
    return false;
  }

  if (assetCondition.kind === "NFT") {
    if (
      transactionEvent.kind === "received_nft" ||
      transactionEvent.kind === "sent_nft"
    ) {
      const assetData = assetsData[transactionEvent.assetId];
      if (!assetData) return false;
      if (assetData.kind !== "NFT") return false;
      return assetData.name
        .toLowerCase()
        .includes(assetCondition.nameContains.toLowerCase());
    }
    // any other transaction event kind won't involve the NFT
    return false;
  }

  return false;
}

function applyEventConditions(
  transactionEvent: TransactionSummary["events"][number],
  eventCondition: EventConditions,
  addressesData: AddressesData,
  assetsData: AssetsData,
  transactionFeePayer: Address
): boolean {
  // Must meet every sub-condition
  return (
    applyEventConditionKind(transactionEvent, eventCondition.kind) &&
    applyEventConditionFromTag(
      transactionEvent,
      eventCondition.fromTag,
      addressesData,
      transactionFeePayer
    ) &&
    applyEventConditionToTag(
      transactionEvent,
      eventCondition.toTag,
      addressesData,
      transactionFeePayer
    ) &&
    applyEventConditionAssetCondition(
      transactionEvent,
      eventCondition.assetCondition,
      assetsData
    )
  );
}

function applyTransactionConditionForAddressTag(
  // Note: for now we've filtered to where feePayer is the address, so can use this
  transactionFeePayer: Address,
  forAddressTag: TransactionConditions["forAddressTag"],
  addressesData: AddressesData
): boolean {
  if (!forAddressTag) return true;

  const forAddressData = addressesData[transactionFeePayer];
  if (!forAddressData) return false;
  return forAddressData.tags.some(
    (t) => t.toLowerCase() === forAddressTag.toLowerCase()
  );
}

function applyTransactionConditionKnownApp(
  transactionKnownApp: TransactionSummary["knownApp"],
  knownApp: TransactionConditions["knownApp"]
): boolean {
  if (!knownApp) return true;
  if (!transactionKnownApp) return false;
  return transactionKnownApp.toLowerCase() === knownApp.toLowerCase();
}

function applyTransactionConditionTimestampGt(
  transactionTimestamp: number,
  timestampGt: NonNullable<TransactionConditions["timestamp"]>["gt"]
): boolean {
  if (!timestampGt) return true;
  return transactionTimestamp >= timestampGt;
}

function applyTransactionConditionTimestampLt(
  transactionTimestamp: number,
  timestampLt: NonNullable<TransactionConditions["timestamp"]>["lt"]
): boolean {
  if (!timestampLt) return true;
  return transactionTimestamp <= timestampLt;
}

function applyTransactionConditionTimestamp(
  transactionTimestamp: number,
  timestamp: TransactionConditions["timestamp"]
): boolean {
  if (!timestamp) return true;
  return (
    applyTransactionConditionTimestampGt(transactionTimestamp, timestamp.gt) &&
    applyTransactionConditionTimestampLt(transactionTimestamp, timestamp.lt)
  );
}

function applyTransactionConditions(
  transactionSummary: TransactionSummary,
  conditions: TransactionConditions,
  addressesData: AddressesData
): boolean {
  return (
    applyTransactionConditionForAddressTag(
      transactionSummary.feePayer,
      conditions.forAddressTag,
      addressesData
    ) &&
    applyTransactionConditionKnownApp(
      transactionSummary.knownApp,
      conditions.knownApp
    ) &&
    applyTransactionConditionTimestamp(
      transactionSummary.timestamp,
      conditions.timestamp
    )
  );
}

function applyFilterCondition(
  transactionSummary: TransactionSummary,
  filterCondition: FilterCondition,
  addressesData: AddressesData,
  assetsData: AssetsData
): boolean {
  if (filterCondition.type === "event") {
    // keep transactions where any event meets the event conditions
    return transactionSummary.events.some((event) =>
      applyEventConditions(
        event,
        filterCondition.conditions,
        addressesData,
        assetsData,
        transactionSummary.feePayer
      )
    );
  }

  if (filterCondition.type === "transaction") {
    return applyTransactionConditions(
      transactionSummary,
      filterCondition.conditions,
      addressesData
    );
  }

  return false;
}

export function applyFilter(
  transactionSummaries: TransactionSummary[],
  filter: Filter,
  addressesData: AddressesData,
  assetsData: AssetsData
): TransactionSummary[] {
  return transactionSummaries.filter((tx) =>
    filter.every((f) => applyFilterCondition(tx, f, addressesData, assetsData))
  );
}
