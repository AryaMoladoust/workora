/* Workora service worker: installable PWA shell, offline fallback and push notifications.
   Pages and API responses are never cached (data is always live and per-user). */
const CACHE = "workora-static-v3";
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
      // Buttons are only supported on Android / desktop browsers (not iOS); the browser tells how many fit.
      const maxActions = typeof Notification !== "undefined" && Notification.maxActions ? Math.min(Notification.maxActions, 2) : 2;
      const actions = Array.isArray(data.actions) ? data.actions.slice(0, maxActions) : [];
      await self.registration.showNotification(data.title || "Workora", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        dir: "rtl",
        lang: "fa",
        vibrate: Array.isArray(data.vibrate) ? data.vibrate : [140],
        requireInteraction: Boolean(data.requireInteraction),
        timestamp: Date.now(),
        actions,
        data: { url: data.url || "/dashboard", kind: data.kind || "", extra: data.data || {} },
      });
    })()
  );
});

// Runs the notification buttons without opening the app:
//   done  -> marks the task as done      mute -> silences the chat conversation
async function runAction(action, extra) {
  const json = { "Content-Type": "application/json" };
  try {
    if (action === "done" && extra && extra.task) {
      const res = await fetch(`/api/projects/${extra.task.projectId}/tasks/${extra.task.taskId}`, { method: "PATCH", credentials: "include", headers: json, body: JSON.stringify({ status: "done" }) });
      return res.ok;
    }
    if (action === "mute" && extra && extra.conversationId) {
      const res = await fetch(`/api/chat/conversations/${extra.conversationId}`, { method: "PATCH", credentials: "include", headers: json, body: JSON.stringify({ muted: true }) });
      return res.ok;
    }
  } catch (e) {}
  return false;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const action = event.action || "";
  const extra = (event.notification.data && event.notification.data.extra) || {};
  if (action === "done" || action === "mute") {
    event.waitUntil(
      (async () => {
        const ok = await runAction(action, extra);
        if (ok) {
          // short confirmation, no sound
          await self.registration.showNotification(action === "done" ? "✅ وظیفه انجام شد" : "🔕 گفتگو بی‌صدا شد", { icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", silent: true, tag: "wk-action-result", dir: "rtl", lang: "fa", data: { url: (event.notification.data && event.notification.data.url) || "/dashboard" } });
          return;
        }
        // could not do it in the background (signed out, offline ...): open the app instead
        await openTarget((event.notification.data && event.notification.data.url) || "/dashboard");
      })()
    );
    return;
  }
  event.waitUntil(openTarget((event.notification.data && event.notification.data.url) || "/dashboard"));
});

async function openTarget(url) {
  const target = new URL(url, self.location.origin).href;
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
}

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
