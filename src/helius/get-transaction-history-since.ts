import { Address, Signature } from "@solana/web3.js";
import { createHeliusRpc } from "./rpc/rpc";
import { GetTransactionHistoryResponse } from "./rpc/get-transaction-history";

type HeliusRpc = NonNullable<ReturnType<typeof createHeliusRpc>>;

async function getTransactionHistoryBatch(
  rpc: HeliusRpc,
  address: Address,
  before?: Signature
): Promise<GetTransactionHistoryResponse> {
  return await rpc
    .getTransactionHistory({
      address,
      before,
      commitment: "confirmed",
      limit: 100,
    })
    .send();
}

export async function getFullTransactionHistory(
  rpc: HeliusRpc,
  address: Address,
  since: Date
): Promise<GetTransactionHistoryResponse> {
  let transactionsSoFar: GetTransactionHistoryResponse = [];
  let before: Signature | undefined = undefined;

  const sinceTimestamp = since.getTime() / 1000;

  while (true) {
    // Note: there's a bug where the Helius API returns <100 transactions even when there are enough to return
    // So we can't just detect batches of 100, work around by checking if all are before timestamp
    const batch = await getTransactionHistoryBatch(rpc, address, before);
    const batchSinceDate = batch.filter((tx) => tx.timestamp >= sinceTimestamp);

    if (batch.length === batchSinceDate.length && batchSinceDate.length > 0) {
      // complete batch to include, continue
      transactionsSoFar = transactionsSoFar.concat(batchSinceDate);

      console.log("getFullTransactionHistory", {
        before,
        batchLength: batch.length,
        batchSinceDateLength: batchSinceDate.length,
        newTransactionsSoFar: transactionsSoFar,
      });

      before = batchSinceDate[batchSinceDate.length - 1].signature;
    } else {
      // partial batch, reached our since date, return
      transactionsSoFar = transactionsSoFar.concat(batchSinceDate);
      return transactionsSoFar;
    }
  }
}
