"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PwaContext = createContext(null);

export function usePwa() {
  const ctx = useContext(PwaContext);
  if (!ctx) throw new Error("usePwa must be used inside <PwaProvider>");
  return ctx;
}

function urlBase64ToUint8Array(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function sameKey(buffer, bytes) {
  if (!buffer) return false;
  const a = new Uint8Array(buffer);
  return a.length === bytes.length && a.every((v, i) => v === bytes[i]);
}

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "درخواست انجام نشد.");
  return data;
}

export default function PwaProvider({ signedIn = false, children }) {
  const router = useRouter();
  const installEvent = useRef(null);
  const [canInstall, setCanInstall] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [permission, setPermission] = useState("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  /* ---------- environment + service worker ---------- */
  useEffect(() => {
    const isStandalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    setStandalone(Boolean(isStandalone));
    const ua = window.navigator.userAgent || "";
    setIos(/iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1));
    setPushSupported("serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
    if ("Notification" in window) setPermission(Notification.permission);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => console.warn("SW register failed", error));
    }

    function onBeforeInstall(event) {
      event.preventDefault();
      installEvent.current = event;
      setCanInstall(true);
    }
    function onInstalled() {
      installEvent.current = null;
      setCanInstall(false);
      setStandalone(true);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  /* ---------- messages coming from the service worker (notification click) ---------- */
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return undefined;
    function onMessage(event) {
      if (event.data?.type === "navigate" && typeof event.data.url === "string") {
        try {
          const u = new URL(event.data.url, window.location.origin);
          if (u.origin === window.location.origin) router.push(`${u.pathname}${u.search}${u.hash}`);
        } catch {}
      }
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  /* ---------- push subscription helpers ---------- */
  const fetchKey = useCallback(async () => {
    const res = await fetch("/api/push/key", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.publicKey) throw new Error(data.error || "کلید اعلان در دسترس نیست.");
    return urlBase64ToUint8Array(data.publicKey);
  }, []);

  // Makes sure the browser holds a subscription made with the current server key and that the server has it.
  const ensureSubscription = useCallback(
    async (reg) => {
      const key = await fetchKey();
      let sub = await reg.pushManager.getSubscription();
      if (sub && !sameKey(sub.options?.applicationServerKey, key)) {
        await sub.unsubscribe();
        sub = null;
      }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      await postJson("/api/push/subscribe", { subscription: sub.toJSON() });
      return sub;
    },
    [fetchKey]
  );

  // Signed in + permission already granted → silently re-sync (new login, rotated key, restored subscription).
  useEffect(() => {
    if (!signedIn || !pushSupported || permission !== "granted") {
      if (!signedIn) setSubscribed(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        await ensureSubscription(reg);
        if (!cancelled) setSubscribed(true);
      } catch (error) {
        console.warn("push sync failed", error);
        if (!cancelled) setSubscribed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn, pushSupported, permission, ensureSubscription]);

  /* ---------- actions ---------- */
  const install = useCallback(async () => {
    const ev = installEvent.current;
    if (!ev) return;
    ev.prompt();
    try {
      await ev.userChoice;
    } finally {
      installEvent.current = null;
      setCanInstall(false);
    }
  }, []);

  const enablePush = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setMessage(result === "denied" ? "اعلان‌ها در تنظیمات مرورگر مسدود شده‌اند." : "اجازه‌ی اعلان داده نشد.");
        return false;
      }
      const reg = await navigator.serviceWorker.ready;
      await ensureSubscription(reg);
      setSubscribed(true);
      return true;
    } catch (error) {
      setMessage(error?.message || "فعال‌سازی اعلان انجام نشد.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [ensureSubscription]);

  const disablePush = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await postJson("/api/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (error) {
      setMessage(error?.message || "خاموش کردن اعلان انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setBusy(true);
    setMessage("");
    try {
      const data = await postJson("/api/push/test");
      setMessage(data.ok ? "اعلان آزمایشی فرستاده شد." : data.devices ? "ارسال به سرویس اعلان ناموفق بود؛ چند لحظه بعد دوباره امتحان کن." : "هنوز دستگاهی ثبت نشده است.");
    } catch (error) {
      setMessage(error?.message || "ارسال انجام نشد.");
    } finally {
      setBusy(false);
    }
  }, []);

  // On logout: this device stops receiving the previous user's notifications (the browser subscription is kept
  // so the next login can re-attach it automatically).
  const detachPush = useCallback(async () => {
    try {
      if (!pushSupported) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await postJson("/api/push/unsubscribe", { endpoint: sub.endpoint });
    } catch {}
  }, [pushSupported]);

  const value = useMemo(
    () => ({ signedIn, canInstall, standalone, ios, pushSupported, permission, subscribed, busy, message, install, enablePush, disablePush, sendTest, detachPush }),
    [signedIn, canInstall, standalone, ios, pushSupported, permission, subscribed, busy, message, install, enablePush, disablePush, sendTest, detachPush]
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}
