"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { ComingSoonDialogHost } from "@/features/coming-soon";
import { PortraitOrientationLock } from "./portrait-orientation-lock";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        <PortraitOrientationLock />
        <ComingSoonDialogHost />
        {children}
      </QueryClientProvider>
    </SessionProvider>
  );
}
