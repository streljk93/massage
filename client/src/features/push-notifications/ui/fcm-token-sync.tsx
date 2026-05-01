"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { resolveApiResourceUrl } from "@/shared/lib/resolve-api-resource-url";
import { getFirebaseWebConfig } from "@/shared/config/firebase-public";
import {
  fcmDataShouldRefetchClientBookingsList,
  requestClientBookingsListRefetch,
} from "@/shared/lib/bookings/fcm-list-refetch";
import { notify } from "@/shared/lib/notifications/notify";
import {
  FCM_IN_APP_TOAST_MS,
  fcmInAppToastFromData,
} from "../lib/format-fcm-in-app-toast";

let firebaseApp: FirebaseApp | null = null;

function getOrInitApp() {
  if (firebaseApp) {
    return firebaseApp;
  }
  const cfg = getFirebaseWebConfig();
  if (!cfg) {
    return null;
  }
  firebaseApp = getApps().length > 0 ? getApps()[0]! : initializeApp(cfg);
  return firebaseApp;
}

/**
 * `navigator.serviceWorker.ready` может относиться не к тому SW, что только что зарегистрировали.
 * Для `getToken` нужен `ServiceWorkerRegistration` с `active` и валидным `pushManager`.
 */
async function waitForActiveFcmRegistration(
  reg: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  if (reg.active) {
    return reg;
  }
  const sw = reg.installing ?? reg.waiting;
  if (sw) {
    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(
        () => reject(new Error("FCM SW: activate timeout (20s)")),
        20000,
      );
      let settled = false;
      const finish = () => {
        if (settled || !reg.active) {
          return;
        }
        settled = true;
        window.clearTimeout(timeout);
        resolve();
      };
      if (sw.state === "activated") {
        finish();
        return;
      }
      sw.addEventListener("statechange", () => finish());
    });
  } else {
    await navigator.serviceWorker.ready;
  }
  return reg;
}

/**
 * После входа: запрашивает разрешение на уведомления, регистрирует SW, отправляет FCM token на API.
 * Без `NEXT_PUBLIC_FIREBASE_*` и VAPID — ничего не делает.
 */
export function FcmTokenSync() {
  const tFcm = useTranslations("fcmInApp");
  const tFcmRef = useRef(tFcm);
  useLayoutEffect(() => {
    tFcmRef.current = tFcm;
  }, [tFcm]);

  const { data: session, status } = useSession();
  /** Не deps на весь `session` — иначе новый объект на каждом рендере и бесконечный SW/getToken в dev. */
  const accessToken = session?.accessToken;
  const lastPostedToken = useRef<string | null>(null);
  /** FCM: при открытой вкладке сообщения идут в onMessage, а не в onBackgroundMessage в SW. */
  const offForeground = useRef<(() => void) | null>(null);

  const showFcmInAppToast = useCallback(
    (rawData: Record<string, string> | undefined, titleIn: string, bodyIn: string | undefined) => {
      const fmt = fcmInAppToastFromData(tFcmRef.current, rawData, {
        title: titleIn,
        body: bodyIn,
      });
      notify.info(fmt.title, fmt.body, { duration: FCM_IN_APP_TOAST_MS });
    },
    [],
  );

  /** Тост in-app, когда FCM пришёл в фоне: SW шлёт postMessage (тот же UX, что и у ручек/dummy). */
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const onSwMessage = (e: MessageEvent) => {
      const d = e.data as
        | {
            fcm?: boolean;
            title?: string;
            body?: string;
            data?: Record<string, string>;
          }
        | undefined;
      if (d?.data && fcmDataShouldRefetchClientBookingsList(d.data)) {
        requestClientBookingsListRefetch();
      }
      if (d?.fcm && typeof d.title === "string") {
        const body = d.body == null || d.body === "" ? undefined : String(d.body);
        showFcmInAppToast(d.data, d.title, body);
      }
    };
    navigator.serviceWorker.addEventListener("message", onSwMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onSwMessage);
  }, [showFcmInAppToast]);

  useEffect(() => {
    if (status !== "authenticated" || accessToken == null || accessToken === "") {
      offForeground.current?.();
      offForeground.current = null;
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      return;
    }

    let cancelled = false;

    const run = async () => {
      if (cancelled) {
        return;
      }
      const app = getOrInitApp();
      if (!app) {
        return;
      }
      const supported = await isSupported();
      if (!supported) {
        return;
      }
      if (typeof Notification === "undefined") {
        return;
      }
      if (Notification.permission === "denied") {
        return;
      }
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted" || cancelled) {
        return;
      }

      const messaging = getMessaging(app);

      if (!offForeground.current && !cancelled) {
        offForeground.current = onMessage(messaging, (payload) => {
          if (process.env.NODE_ENV === "development") {
             
            console.debug("[FcmTokenSync] FCM onMessage (foreground)", payload);
          }
          const raw = payload.data as Record<string, string> | undefined;
          if (fcmDataShouldRefetchClientBookingsList(raw)) {
            requestClientBookingsListRefetch();
          }
          if (Notification.permission !== "granted") {
            return;
          }
          const n = payload.notification;
          const d = payload.data;
          const title = n?.title || d?.pushTitle || d?.title;
          const body = n?.body || d?.pushBody || d?.body;
          if (title == null && body == null) {
            if (process.env.NODE_ENV === "development") {
               
              console.debug(
                "[FcmTokenSync] onMessage: no notification and no pushTitle/pushBody in data, skip",
              );
            }
            return;
          }
          const rawData = d as Record<string, string> | undefined;
          const t =
            (title == null || title === "") && body
              ? tFcmRef.current("genericMessageTitle")
              : (title ?? tFcmRef.current("genericMessageTitle"));
          const b = body == null || body === "" ? undefined : String(body);
          showFcmInAppToast(rawData, t, b);
          void (async () => {
            try {
              const reg = await navigator.serviceWorker.ready;
              const tag = `fcm-fg-${Date.now()}`;
              const shown = fcmInAppToastFromData(tFcmRef.current, rawData, {
                title: t,
                body: b,
              });
              await reg.showNotification(shown.title, {
                body: shown.body,
                icon: new URL("/massage.png", window.location.origin).href,
                tag,
              });
            } catch (e) {
              console.warn(
                "[FcmTokenSync] showNotification via SW failed, fallback to Notification()",
                e,
              );
              const shown = fcmInAppToastFromData(tFcmRef.current, rawData, {
                title: t,
                body: b,
              });
              new Notification(shown.title, { body: shown.body });
            }
          })();
        });
      }

      const swReg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" },
      );
      if (cancelled) {
        return;
      }
      const activeReg = await waitForActiveFcmRegistration(swReg);
      if (cancelled) {
        return;
      }
      if (!activeReg.pushManager) {
        console.warn(
          "[FcmTokenSync] registration.pushManager missing (not a secure context or SW not ready)",
        );
        return;
      }
      let token: string;
      try {
        token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: activeReg,
        });
      } catch (e) {
        try {
          token = await getToken(messaging, { vapidKey });
        } catch (e2) {
          console.warn(
            "[FcmTokenSync] getToken failed (with and without explicit SW)",
            e,
            e2,
          );
          return;
        }
      }
      if (!token || token === lastPostedToken.current) {
        return;
      }

      let res: Response;
      try {
        res = await fetch(resolveApiResourceUrl("/v1/users/me/push-tokens"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            token,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          }),
        });
      } catch (e) {
        console.warn(
          "[FcmTokenSync] push-tokens fetch failed (network, CORS, or extension blocking fetch)",
          e,
        );
        return;
      }
      if (res.ok) {
        lastPostedToken.current = token;
      }
    };

    const startRun = () => {
      if (cancelled) {
        return;
      }
      void run().catch((e) => {
        console.warn("[FcmTokenSync] run failed", e);
      });
    };

    /**
     * В dev Firebase + SW конкурируют с React Fast Refresh / Strict Mode.
     * Откладываем на idle (с дедлайном), чтобы не забивать CPU в горячую фазу.
     */
    let idleHandle: number | undefined;
    /** DOM `setTimeout` — число; не `NodeJS.Timeout` из типов Node. */
    let runTimeoutHandle: number | undefined;
    if (process.env.NODE_ENV === "development") {
      if (typeof requestIdleCallback !== "undefined") {
        idleHandle = requestIdleCallback(startRun, { timeout: 5000 });
      } else {
        runTimeoutHandle = window.setTimeout(startRun, 750);
      }
    } else {
      startRun();
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined && typeof cancelIdleCallback !== "undefined") {
        cancelIdleCallback(idleHandle);
      }
      if (runTimeoutHandle !== undefined) {
        window.clearTimeout(runTimeoutHandle);
      }
      offForeground.current?.();
      offForeground.current = null;
    };
  }, [accessToken, showFcmInAppToast, status]);

  return null;
}
