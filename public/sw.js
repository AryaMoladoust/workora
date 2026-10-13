/* Workora service worker: installable PWA shell, offline fallback and push notifications.
   Pages and API responses are never cached (data is always live and per-user). */
const CACHE = "workora-static-v2";
const PRECACHE = ["/offline.html", "/icons/icon-192.png", "/icons/badge-96.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("workora-static-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Only page navigations are handled: network first, offline page when the network is down.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate") return;
  event.respondWith(fetch(req).catch(async () => (await caches.match("/offline.html")) || Response.error()));
});

/* ----------------------------------------------------------------- push */
const UA = (self.navigator && self.navigator.userAgent) || "";
// Safari / iOS require every push to show a notification, so we never skip it there.
const IS_APPLE = /iPhone|iPad|iPod/.test(UA) || (/Safari/.test(UA) && !/Chrome|Chromium|Edg|OPR|Android/.test(UA));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const watching = windows.some((w) => w.visibilityState === "visible" && w.focused);
      // The app is open and in front: the in-app UI already updates, so no system banner (not on Apple).
      if (watching && !IS_APPLE && data.kind !== "test") {
        windows.forEach((w) => w.postMessage({ type: "push", payload: data }));
        return;
      }
      await self.registration.showNotification(data.title || "Workora", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        dir: "rtl",
        lang: "fa",
        data: { url: data.url || "/dashboard" },
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/dashboard", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const mine = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (mine) {
        try {
          await mine.focus();
        } catch (e) {}
        mine.postMessage({ type: "navigate", url: target });
        return;
      }
      await self.clients.openWindow(target);
    })()
  );
});

// The browser rotated/expired the subscription: subscribe again and tell the server.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keyRes = await fetch("/api/push/key", { credentials: "include" });
        if (!keyRes.ok) return;
        const { publicKey } = await keyRes.json();
        const pad = "=".repeat((4 - (publicKey.length % 4)) % 4);
        const raw = atob((publicKey + pad).replace(/-/g, "+").replace(/_/g, "/"));
        const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
        const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        await fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: sub.toJSON() }),
        });
      } catch (e) {}
    })()
  );
});
