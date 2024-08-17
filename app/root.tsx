import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient } from "./query-client";
import { createIDBPersister } from "./idb-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ClientOnly } from "remix-utils/client-only";
import { MantineProvider } from "@mantine/core"

import "@mantine/core/styles.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// Will persist query data to IndexedDB
const queryClientPersister = createIDBPersister();

export default function App() {
  return (
    <MantineProvider forceColorScheme="dark">
      <ClientOnly fallback={<Outlet />}>
        {() => <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryClientPersister,
            maxAge: Infinity,
          }}
        >
          <ReactQueryDevtools />
          <Outlet />
        </PersistQueryClientProvider>
        }</ClientOnly>
    </MantineProvider>
  )
}
