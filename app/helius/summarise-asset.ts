import { GetAssetBatchResponse } from "./rpc/get-asset-batch";

type HeliusAsset = GetAssetBatchResponse[number];

type SummarisedFungibleToken = {
  kind: "fungibleToken";
  name?: string;
  symbol: string;
  decimals: number;
  image?: string;
};

type SummarisedNFT = {
  kind: "NFT";
  name: string;
  image?: string;
};

export type SummarisedAsset = SummarisedFungibleToken | SummarisedNFT;

export function summariseAsset(asset: HeliusAsset): SummarisedAsset {
  const image = asset.content.files.find(
    (f) =>
      f.mime === "image/jpeg" ||
      f.mime === "image/png" ||
      f.mime === "image/gif"
  )?.cdn_uri;

  if (asset.interface === "FungibleToken") {
    return {
      kind: "fungibleToken",
      name: asset.content.metadata.name,
      symbol: asset.content.metadata.symbol ?? asset.token_info.symbol,
      decimals: Number(asset.token_info.decimals),
      image,
    };
  } else {
    return {
      kind: "NFT",
      name: asset.content.metadata.name,
      image,
    };
  }
}
