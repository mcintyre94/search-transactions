import { getDefaultResponseTransformerForSolanaRpc } from "@solana/rpc-transformers";
import {
  createDefaultRpcTransport,
  createRpc,
  createSolanaRpcApi,
  DEFAULT_RPC_CONFIG,
  type Rpc,
  type RpcApi,
  type RpcApiMethods,
  type RpcTransport,
  type SolanaRpcApiMainnet,
} from "@solana/web3.js";

import {
  HeliusApiUrl,
  makeHeliusApiUrl,
  makeHeliusJsonRpcUrl,
} from "../make-url.js";

import type {
  GetAssetBatchParams,
  GetAssetBatchResponse,
} from "./get-asset-batch.js";
import type {
  GetTransactionHistoryParams,
  GetTransactionHistoryResponse,
} from "./get-transaction-history.js";

interface HeliusApi extends RpcApiMethods {
  getAssetBatch(params: GetAssetBatchParams): GetAssetBatchResponse;
  getTransactionHistory(
    params: GetTransactionHistoryParams
  ): GetTransactionHistoryResponse;
}

const heliusApiMethods = ["getTransactionHistory"] as const;
const heliusCustomJsonRpcMethods = ["getAssetBatch"] as const;
const heliusMethods = [
  ...heliusApiMethods,
  ...heliusCustomJsonRpcMethods,
] as const;

function createFetchTransport(heliusApiUrl: HeliusApiUrl): RpcTransport {
  return async <TResponse>(
    ...args: Parameters<RpcTransport>
  ): Promise<TResponse> => {
    const { method, params } = args[0].payload as {
      method: (typeof heliusApiMethods)[number];
      params: Record<string, unknown>;
    };

    const url = new URL(heliusApiUrl);
    if (method === "getTransactionHistory") {
      const { address, ...otherParams } = params as GetTransactionHistoryParams;
      url.pathname += `addresses/${address}/transactions`;
      Object.entries(otherParams).forEach(([k, v]) =>
        url.searchParams.append(k, String(v))
      );
    }

    const response = await fetch(url, { signal: args[0].signal });
    if (!response.ok) {
      throw new Error(`Error making fetch request to ${url}`);
    }
    const data = await response.json();
    return data as TResponse;
  };
}

type SplitTransportConfig = Readonly<{
  jsonRpcTransport: RpcTransport;
  fetchTransport: RpcTransport;
}>;

function createSplitTransport({
  jsonRpcTransport,
  fetchTransport,
}: SplitTransportConfig): RpcTransport {
  return async <TResponse>(
    ...args: Parameters<RpcTransport>
  ): Promise<TResponse> => {
    const payload = args[0].payload as {
      method: (typeof heliusMethods)[number];
    };

    if (
      heliusApiMethods.includes(
        payload.method as (typeof heliusApiMethods)[number]
      )
    ) {
      return await fetchTransport(...args);
    }

    return await jsonRpcTransport(...args);
  };
}

export function createHeliusRpc(
  apiKey: string
): Rpc<SolanaRpcApiMainnet & HeliusApi> {
  const heliusApiUrl = makeHeliusApiUrl(apiKey);
  const heliusJsonRpcUrl = makeHeliusJsonRpcUrl(apiKey);

  const solanaRpcApi =
    createSolanaRpcApi<SolanaRpcApiMainnet>(DEFAULT_RPC_CONFIG);

  const customizedApi = new Proxy(solanaRpcApi, {
    defineProperty() {
      return false;
    },
    deleteProperty() {
      return false;
    },
    get(target, p, receiver) {
      const methodName = p.toString() as (typeof heliusMethods)[number];
      if (heliusMethods.includes(methodName)) {
        return (params: unknown[]) => {
          console.log({ methodName, params });

          return {
            methodName,
            // Note that Helius params are just an object, not a list
            params,
            responseTransformer:
              methodName === "getTransactionHistory"
                ? undefined
                : getDefaultResponseTransformerForSolanaRpc({
                    // TODO: should review this and see if we need any
                    allowedNumericKeyPaths: {},
                  }),
          };
        };
      }
      return Reflect.get(target, p, receiver);
    },
  }) as RpcApi<SolanaRpcApiMainnet & HeliusApi>;

  const splitTransport = createSplitTransport({
    jsonRpcTransport: createDefaultRpcTransport({ url: heliusJsonRpcUrl }),
    fetchTransport: createFetchTransport(heliusApiUrl),
  });

  return createRpc({ api: customizedApi, transport: splitTransport });
}
