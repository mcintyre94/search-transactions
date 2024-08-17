import { Address } from "@solana/web3.js";
import { HeliusRpc } from "../helius/rpc/rpc";
import { getAllAssets } from "../helius/get-all-asset-batches";
import { summariseAsset, SummarisedAsset } from "../helius/summarise-asset";
import { queryClient } from "../query-client";

export function getAssetQueryKey(assetId: Address) {
  return ["assets", assetId];
}

export async function fetchAndSaveAssetsQueryData(
  assetIds: Set<Address>,
  rpc: HeliusRpc
) {
  const heliusAssetData = await getAllAssets(rpc, assetIds);

  for (const heliusAsset of heliusAssetData) {
    const summarised = summariseAsset(heliusAsset);
    queryClient.setQueryData(["assets", heliusAsset.id], summarised);
  }
}

export function getAssetsQueryData(): Record<Address, SummarisedAsset> {
  const data = queryClient.getQueriesData<SummarisedAsset>({
    queryKey: ["assets"],
  });

  const assetsQueryData: Record<Address, SummarisedAsset> = {};

  for (const [queryKey, queryData] of data) {
    if (queryData) {
      const address = queryKey[1] as Address;
      assetsQueryData[address] = queryData;
    }
  }

  return assetsQueryData;
}
