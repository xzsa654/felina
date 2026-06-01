import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      staleTime: 2 * 60 * 1000,
      retry: 2,
      refetchOnMount: true,
    },
    mutations: {
      retry: 0,
    },
  },
});
