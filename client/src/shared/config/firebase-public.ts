export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

/**
 * Публичные ключи веб‑приложения Firebase (такие же, как в консоли → Project settings → Your apps).
 * Без полного набора FCM (getToken) не инициализируем.
 */
export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !messagingSenderId || !appId) {
    return null;
  }
  return {
    apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId,
    appId,
  };
}

/**
 * Монтировать ли `FcmTokenSync` в корне приложения.
 * Если false — компонент не рендерится: нет хуков, SW-listener’ов и работы Firebase в клиенте.
 * Условие: заданы VAPID и полный публичный конфиг Firebase (иначе пуш на клиенте всё равно не поднять).
 */
export function isWebPushClientSyncEnabled(): boolean {
  const vapid = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (vapid == null || vapid === "") {
    return false;
  }
  return getFirebaseWebConfig() != null;
}
