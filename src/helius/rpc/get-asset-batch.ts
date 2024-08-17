import { Address } from "@solana/web3.js";

// Note: typing here is not sophisticated or complete, only dealing with use cases we're concerned about
export type GetAssetBatchParams = Readonly<{
  ids: readonly Address[];
  options?: Readonly<{
    showUnverifiedCollections: boolean;
    showCollectionMetadata: boolean;
    showInscription: boolean;
  }>;
}>;

// This allows autocompletion of the image types
type ImageMimeType = "image/jpeg" | "image/png";
type MimeType = ImageMimeType | (string & Record<string, never>);

type ItemContentFile = Readonly<{
  uri: string;
  cdn_uri: string;
  mime: MimeType;
}>;

type FungibleTokenItem = Readonly<{
  interface: "FungibleToken";
  id: Address; // the token mint address
  content: {
    files: readonly ItemContentFile[];
    metadata: Readonly<{
      name: string;
      symbol: string;
    }>;
  };
  token_info: Readonly<{
    decimals: number;
  }>;
}>;

type V1NFTItem = Readonly<{
  interface: "V1_NFT";
  id: Address; // NFT address
  content: {
    files: readonly ItemContentFile[];
    metadata: Readonly<{
      name: string;
    }>;
  };
}>;

// TODO: other types - Fungible Asset, Programmable NFT, MPLCoreAsset
// Helius confirmed some types not used: Identity, V1_PRINT and V2_NFT

export type GetAssetBatchResponse = readonly (FungibleTokenItem | V1NFTItem)[];
