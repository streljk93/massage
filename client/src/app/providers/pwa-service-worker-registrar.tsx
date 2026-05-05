"use client";

import { useEffect } from "react";

/**
 * Регистрация только в production: в dev HMR и дубли SW мешают разработке.
 * Один SW с корня (`/firebase-messaging-sw.js`): и PWA, и FCM (когда они включены).
 */
export function PwaServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .register("/firebase-messaging-sw.js", { scope: "/" })
      .catch(() => {});
  }, []);

  return null;
}
