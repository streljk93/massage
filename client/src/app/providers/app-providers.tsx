"use client";

import dynamic from "next/dynamic";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { ComingSoonDialogHost } from "@/features/coming-soon";
import { createAppQueryClient } from "@/shared/lib/notifications";
import { ConfirmActionHost } from "@/shared/ui/confirm-action-host";
import { PortraitOrientationLock } from "./portrait-orientation-lock";
import { ThemePreferenceProvider } from "@/shared/lib/theme-preference-provider";

const NotificationToaster = dynamic(
  () =>
    import("@/shared/ui/notification-toaster").then((m) => ({
      default: m.NotificationToaster,
    })),
  { ssr: false, loading: () => null },
);

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  const [queryClient] = useState(() => createAppQueryClient());

  return (
    <SessionProvider refetchInterval={300}>
      <QueryClientProvider client={queryClient}>
        <ThemePreferenceProvider>
        <NotificationToaster />
        <ConfirmActionHost />
        <PortraitOrientationLock />
        <ComingSoonDialogHost />
        {children}
        </ThemePreferenceProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
