import { QueryClient } from "@tanstack/react-query";

// Avoid refetching query data automatically
export const queryClient = new QueryClient({
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
