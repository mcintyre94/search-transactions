import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import {
  QueryClient,
  useIsRestoring,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

function App() {
  const queryClient = useQueryClient();
  const isRestoring = useIsRestoring();

  const count = useQuery({
    queryKey: ["count"],
    queryFn: () => 5,
  });

  // Mutations
  const mutation = useMutation({
    mutationFn: () => {},
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.setQueryData(["count"], (c) => c + 1);
    },
  });

  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => mutation.mutate()}>count is {count.data}</button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <p>{isRestoring ? "Restoring..." : "Not restoring"}</p>
    </>
  );
}

export default App;
