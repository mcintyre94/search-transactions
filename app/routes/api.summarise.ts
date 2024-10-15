import { ActionFunctionArgs } from "@remix-run/node";
import { GetTransactionHistoryResponse } from "~/helius/rpc/get-transaction-history";
import { summariseParsedTransaction } from "~/helius/summarise-transaction";

export async function loader({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const searchParams = new URLSearchParams(url.search);
  const transactionSignature = searchParams.get("transaction");

  if (!transactionSignature) {
    return {
      error: "No transaction signature provided",
    };
  }

  const heliusApiKey = process.env.HELIUS_API_KEY;

  if (!heliusApiKey) {
    return {
      error: "No Helius API key available",
    };
  }

  // TODO: push into Helius RPC
  const result = await fetch(
    `https://api.helius.xyz/v0/transactions?api-key=${heliusApiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        transactions: [transactionSignature],
      }),
    }
  );

  if (!result.ok) {
    return {
      error: "Failed to fetch transaction",
    };
  }

  const transaction: GetTransactionHistoryResponse[number] = (
    await result.json()
  )[0];

  BigInt.prototype["toJSON"] = function () {
    return this.toString();
  };

  return summariseParsedTransaction(transaction, transaction.feePayer);
}
