import { Address } from "@solana/web3.js";
import { GetAssetBatchResponse } from "./rpc/get-asset-batch";
import { HeliusRpc } from "./rpc/rpc";

function splitIntoBatches<T>(list: T[], batchSize: number): T[][] {
  const batches: T[][] = [];

  for (let i = 0; i < list.length; i += batchSize) {
    const batch = list.slice(i, i + batchSize);
    batches.push(batch);
  }

  return batches;
}

export async function getAllAssets(
  rpc: HeliusRpc,
  assetIds: Set<Address>
): Promise<GetAssetBatchResponse> {
  const assetIdsList = Array.from(assetIds);
  const batches = splitIntoBatches(assetIdsList, 1000);

  let fetchedAssets: GetAssetBatchResponse = [];

  for (const batch of batches) {
    const response = await rpc
      .getAssetBatch({
        ids: batch,
        options: {
          showUnverifiedCollections: false,
          showCollectionMetadata: false,
          showInscription: false,
        },
      })
      .send();

    fetchedAssets = fetchedAssets.concat(response);
  }

  return fetchedAssets;
}
