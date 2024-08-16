import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient } from "@tanstack/react-query";
import { createIDBPersister } from "./idb-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import FetchTransactions from "./routes/FetchTransactions";
import { router } from "./routes/router";

// Will persist query data to IndexedDB
const queryClientPersister = createIDBPersister();

// Avoid refetching query data automatically
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Needs to be at least maxAge, which defaults to 24 hours
      // See https://tanstack.com/query/latest/docs/framework/react/plugins/persistQueryClient#how-it-works
      gcTime: Infinity, // 1000 * 60 * 60 * 24, // 24 hours
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      maxAge={Infinity}
      persistOptions={{ persister: queryClientPersister }}
    >
      <MantineProvider forceColorScheme="dark">
        <RouterProvider router={router} />
      </MantineProvider>
    </PersistQueryClientProvider>
  </StrictMode>
);
