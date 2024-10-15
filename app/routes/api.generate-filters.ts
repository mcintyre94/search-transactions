import { ActionFunctionArgs } from "react-router-dom";

// Note: this file needs to run on the server because Claude won't accept requests from a browser
// Was originally going to have users bring their own Claude API key, will need to re-think that!

type FormDataUpdates = {
  filterDescription: string;
};

type ClaudeResponse = {
  content: {
    type: "text";
    text: string;
  }[];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const updates = Object.fromEntries(formData) as unknown as FormDataUpdates;

  // Original reason not to use the Anthropic SDK was because it doesn't work in browser
  // We were just using the API key in the client from the form, not a shared key on the server
  // Also don't think their caching is supported by the API yet

  const url = "https://api.anthropic.com/v1/messages";

  const headers = {
    "Content-Type": "application/json",
    "X-API-Key": process.env.CLAUDE_API_KEY!,
    "anthropic-version": "2023-06-01",
    "anthropic-beta": "prompt-caching-2024-07-31",
  };

  const body = {
    model: "claude-3-5-sonnet-20240620",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: 'I am going to provide a request to filter `TransactionSummary` data, and I need you to convert it to JSON with a structure I will provide\nA `TransactionSummary` is structured like this:\n\n```ts\ntype TransactionEvent =\n  | { kind: "received_sol"; lamports: bigint; from: Address[] }\n  | { kind: "sent_sol"; lamports: bigint; to: Address[] }\n  | { kind: "received_token"; mint: Address; uiAmount: number; from: Address[] }\n  | { kind: "sent_token"; mint: Address; uiAmount: number; to: Address[] }\n  | { kind: "received_nft"; assetId: Address; from?: Address }\n  | { kind: "sent_nft"; assetId: Address; to: Address }\n\ntype TransactionSummary = {\n  forAddress: Address;\n  knownApp?: KnownAppNames;\n  timestamp: number;\n  events: TransactionEvent[];\n}\n```\n\nYou can treat the `Address` and `KnownAppNames` types as strings \n\nThe `forAddress`, and any to/from Address referenced in events may refer to a known address. Known addresses are stored like this:\n\n```ts\ntype AddressQueryData = {\n  tags: string[]\n}\naddressData: Record<Address, AddressQueryData>\n```\n\nThe mint for a token send/receive, and the assetId for an NFT send/receive may refer to a known NFT or fungible token. These assets are described like this:\n\n```ts\ntype SummarisedFungibleToken = {\n  kind: "fungibleToken";\n  symbol: string;\n}\n\ntype SummarisedNFT = {\n  kind: "NFT";\n  name: string;\n}\n\nexport type SummarisedAsset = SummarisedFungibleToken | SummarisedNFT\n```\n\nWhen I provide a request for a filter over transactions, I need you to output JSON with this type:\n\n```ts\ntype TimestampCondition = {\n  gt?: number; // Greater than, in unix epoch seconds\n  lt?: number; // Less than, in unix epoch seconds\n};\n\ntype FungibleTokenCondition = {\n  kind: "token";\n  symbol: string; // Filter by token symbol (e.g. "BONK", "USDC"), case insensitive\n};\n\ntype NFTCondition = {\n  kind: "NFT";\n  nameContains: string; // Partial match for NFT name, case insensitive\n};\n\ntype AssetCondition = FungibleTokenCondition | NFTCondition;\n\ntype EventConditions = {\n  kind?:\n    | "received_sol"\n    | "sent_sol"\n    | "received_token"\n    | "sent_token"\n    | "received_nft"\n    | "sent_nft";\n  fromTag?: string; // Tag for the `from` address\n  toTag?: string; // Tag for the `to` address\n  assetCondition?: AssetCondition; // Asset conditions (symbol or address or nameContains)\n};\n\ntype TransactionConditions = {\n  forAddressTag?: string;\n  timestamp?: TimestampCondition;\n  knownApp?: KnownAppNames;\n};\n\ntype FilterCondition =\n  | { type: "event"; conditions: EventConditions }\n  | { type: "transaction"; conditions: TransactionConditions };\n\ntype Filter = FilterCondition[];\n```\n\nYou should output JSON with type Filter\nPlease only respond with valid JSON without newlines\n\n<example>\n<request>\nShow transactions where SOL was sent in the last week\n</request>\n<response>\n[{"type": "transaction", "conditions": {"timestamp": {"gt": 1691510400}}},{"type": "event","conditions": {"kind": "sent_sol"}}]\n</response>\n</example>\n\n<example>\n<request>\nFind transactions where a Claynosaurz NFT was received\n</request>\n<response>\n[{"type": "event", "conditions": {"kind": "received_nft", "assetCondition": {"kind": "NFT", "nameContains": "claynosaurz"}}}]\n</response>\n</example>\n\n<example>\n<request>\nShow all transactions to the Jupiter app from a defi wallet\n</request>\n<response>\n[{type: "transaction", conditions: {forAddressTag: "defi", knownApp: "jupiter"}}]\n</response>\n</example>\n\n<example>\n<request>\nIdentify transactions where a token is sent from a hot to a cold wallet\n</request>\n<response>\n[{type: "event", "conditions": {"kind": "sent_token", "fromTag": "hot", "toTag": "cold"}}]\n</response>\n</example>\n\n<example>\n<request>\nShow transactions from a hot wallet\n</request>\n<response>\n[{type: "transaction", conditions: {forAddressTag: "hot"}}]\n</response>\n</example>',
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Show transactions ${updates.filterDescription}`,
      },
    ],
  };

  try {
    const claudeResponse = (await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
    }).then((response) => response.json())) as ClaudeResponse;

    const firstResponse = claudeResponse.content[0];
    if (firstResponse.type === "text") {
      return JSON.parse(firstResponse.text);
    }

    return {
      error: "Unexpected response from Claude API",
    };
  } catch (error) {
    return {
      error: "Unexpected response from Claude API",
    };
  }
}
