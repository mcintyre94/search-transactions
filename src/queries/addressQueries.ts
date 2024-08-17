import { Address } from "@solana/web3.js";
import { OrbitAccount } from "../orbit-accounts/orbitAccount";
import {
  summariseParsedTransaction,
  TransactionSummary,
} from "../helius/summarise";
import { HeliusRpc } from "../helius/rpc/rpc";
import { getFullTransactionHistory } from "../helius/get-transaction-history-since";
import { queryClient } from "../query-client";

type AddressQueryData = Omit<OrbitAccount, "address" | "notes"> & {
  fetchedSince: Date;
  summarisedTransactions: TransactionSummary[];
};

export function getAddressQueryKey(address: Address) {
  return ["addresses", address];
}

export async function fetchAndSaveAddressQueryData(
  account: OrbitAccount,
  rpc: HeliusRpc,
  fetchSince: Date
) {
  const { address } = account;
  const transactions = await getFullTransactionHistory(
    rpc,
    address,
    fetchSince
  );
  const summarised = transactions.map((t) =>
    summariseParsedTransaction(t, address)
  );

  queryClient.setQueryData<AddressQueryData>(getAddressQueryKey(address), {
    label: account.label,
    tags: account.tags,
    fetchedSince: fetchSince,
    summarisedTransactions: summarised,
  });
}

export function getAddressQueryData(): Record<Address, AddressQueryData> {
  const data = queryClient.getQueriesData<AddressQueryData>({
    queryKey: ["addresses"],
  });

  const addressQueryData: Record<Address, AddressQueryData> = {};

  for (const [queryKey, queryData] of data) {
    if (queryData) {
      const address = queryKey[1] as Address;
      addressQueryData[address] = queryData;
    }
  }

  return addressQueryData;
}
