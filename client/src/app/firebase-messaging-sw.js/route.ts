import { NextResponse } from "next/server";

/** Совпадает с `client/package.json` → `firebase` (importScripts в SW). */
const FIREBASE_JS_VERSION = "11.10.0";

/**
 * Общая оболочка PWA и FCM в одном SW (scope `/`): иначе две регистрации конфликтуют.
 * Критерий установки (Chrome/Android): активный обработчик `fetch`.
 */
const PWA_SERVICE_WORKER_BOOTSTRAP = `
self.addEventListener("install", (event) => {
  event.waitUntil(Promise.resolve().then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.resolve().then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
`;

/**
 * FCM service worker: должен отдаваться с корня origin как `/firebase-messaging-sw.js`.
 * Конфиг подставляется из тех же `NEXT_PUBLIC_FIREBASE_*`, что и в клиентском бандле.
 */
export async function GET() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "";
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !projectId || !messagingSenderId || !appId) {
    return new NextResponse(
      `${PWA_SERVICE_WORKER_BOOTSTRAP}console.warn('[FCM] Missing NEXT_PUBLIC_FIREBASE_* in env');\n`,
      {
        status: 200,
        headers: {
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const config = {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };

  const body = `${PWA_SERVICE_WORKER_BOOTSTRAP}importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_JS_VERSION}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_JS_VERSION}/firebase-messaging-compat.js');
firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification;
  const d = payload.data || {};
  const title = (n && n.title) || d.pushTitle || d.title || 'Message';
  const body = (n && n.body) || d.pushBody || d.body || '';
  const options = {
    body: String(body),
    data: payload.data || {},
    icon: '/pwa/icon-192.png',
    tag: 'fcm-' + (d.type || 'push'),
  };
  var showPromise = self.registration.showNotification(String(title), options);
  var done = function () {
    if (!self.clients || !self.clients.matchAll) {
      return;
    }
    return self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (list) {
        list.forEach(function (c) {
          c.postMessage({
            fcm: true,
            title: String(title),
            body: String(body),
            data: d,
          });
        });
      });
  };
  if (showPromise && typeof showPromise.then === 'function') {
    return showPromise.then(done);
  }
  return done();
});
`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
