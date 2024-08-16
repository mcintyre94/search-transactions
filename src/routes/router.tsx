import { createBrowserRouter } from "react-router-dom";
import FetchTransactions, { action as fetchTransactionsAction, } from "./FetchTransactions";
import React from "react";

export const router = createBrowserRouter([
    {
        path: "/fetch-transactions",
        element: <FetchTransactions />,
        action: fetchTransactionsAction,
    },
]);