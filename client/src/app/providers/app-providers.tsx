"use client";

import dynamic from "next/dynamic";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "next-auth/react";
import { useState, type ReactNode } from "react";
import { ComingSoonDialogHost } from "@/features/coming-soon";
import { createAppQueryClient } from "@/shared/lib/notifications";
import { ConfirmActionHost } from "@/shared/ui/confirm-action-host";
import { PortraitOrientationLock } from "./portrait-orientation-lock";
import { FavoritesSyncOnAuth } from "@/features/favorites-sync";
import { SyncUserLocaleWithApp } from "@/features/user-locale-sync";
// import { FcmTokenSync } from "@/features/push-notifications";
// import { isWebPushClientSyncEnabled } from "@/shared/config/firebase-public";
import { ThemePreferenceProvider } from "@/shared/lib/theme-preference-provider";

import { PwaServiceWorkerRegistrar } from "./pwa-service-worker-registrar";

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
        <FavoritesSyncOnAuth />
        <SyncUserLocaleWithApp />
        {/* {isWebPushClientSyncEnabled() ? <FcmTokenSync /> : null} */}
        <NotificationToaster />
        <ConfirmActionHost />
        <PortraitOrientationLock />
        <PwaServiceWorkerRegistrar />
        <ComingSoonDialogHost />
        {children}
        </ThemePreferenceProvider>
      </QueryClientProvider>
    </SessionProvider>
  );
}
