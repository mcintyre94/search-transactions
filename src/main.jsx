import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createIDBPersister } from "./idb-persister";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { RouterProvider } from "react-router-dom";

import "@mantine/core/styles.css";
import { Indicator, MantineProvider } from "@mantine/core";
import { router } from "./routes/router";
import { queryClient } from "./query-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// Will persist query data to IndexedDB
const queryClientPersister = createIDBPersister();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryClientPersister,
        maxAge: Infinity,
      }}
    >
      <ReactQueryDevtools />
      <MantineProvider forceColorScheme="dark">
        <RouterProvider router={router} />
      </MantineProvider>
    </PersistQueryClientProvider>
  </StrictMode>
);
