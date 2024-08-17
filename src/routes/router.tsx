import { createBrowserRouter } from "react-router-dom";
import DisplayTransactions, { action as displayTransactionsAction } from "./DisplayTransactions";
import FetchTransactions, { action as fetchTransactionsAction, } from "./FetchTransactions";
import React from "react";
import { queryClient } from "../query-client";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <DisplayTransactions />,
        action: displayTransactionsAction,
        // loader: dtl,
    },
    {
        path: "/fetch-transactions",
        element: <FetchTransactions />,
        action: fetchTransactionsAction,
    },
]);