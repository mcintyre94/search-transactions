export type HeliusApiUrl = string & {
  readonly __brand: unique symbol;
};

export function makeHeliusApiUrl(apiKey: string): HeliusApiUrl {
  return `https://api.helius.xyz/v0/?api-key=${apiKey}` as HeliusApiUrl;
}

export type HeliusJsonRpcUrl = string & {
  readonly __brand: unique symbol;
};

export function makeHeliusJsonRpcUrl(apiKey: string): HeliusJsonRpcUrl {
  return `https://mainnet.helius-rpc.com/?api-key=${apiKey}` as HeliusJsonRpcUrl;
}
