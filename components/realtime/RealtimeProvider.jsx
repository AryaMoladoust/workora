"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useToast } from "../ui/Feedback";

const RealtimeContext = createContext(null);

// Serverless hosts (Vercel) cannot hold WebSocket connections. Set NEXT_PUBLIC_REALTIME=polling there:
// the app then never opens a socket and every live feature uses short polling instead.
const POLLING_ONLY = process.env.NEXT_PUBLIC_REALTIME === "polling";

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error("useRealtime must be used inside <RealtimeProvider>");
  return ctx;
}

// One WebSocket per browser tab (shared by the bell, the sidebar badges and the chat).
// status: "connecting" | "open" | "closed" | "polling".  If the socket is down, counters fall back to polling.
export default function RealtimeProvider({ userId, initialUnread = 0, initialChatUnread = 0, children }) {
  const [status, setStatus] = useState(POLLING_ONLY ? "polling" : "connecting");
  const [unread, setUnread] = useState(initialUnread);
  const [chatUnread, setChatUnread] = useState(initialChatUnread);
  const handlers = useRef(new Set());
  const statusRef = useRef("connecting");
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const seen = useRef(new Set());
  const primed = useRef(false);
  const lastUnread = useRef(initialUnread);

  useEffect(() => setUnread(initialUnread), [initialUnread]);
  useEffect(() => setChatUnread(initialChatUnread), [initialChatUnread]);

  const subscribe = useCallback((handler) => {
    handlers.current.add(handler);
    return () => handlers.current.delete(handler);
  }, []);

  const emit = useCallback((event) => {
    for (const handler of handlers.current) {
      try {
        handler(event);
      } catch (error) {
        console.error("realtime handler failed", error);
      }
    }
  }, []);

  // In-app (glass) banner for every new notification. The first run only records what already exists.
  const announceNew = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications?unread=1&limit=5", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      const fresh = (d.notifications || []).filter((n) => !n.read && !seen.current.has(n.id));
      for (const n of fresh) seen.current.add(n.id);
      if (!primed.current) {
        primed.current = true;
        return;
      }
      for (const n of fresh.reverse().slice(-3)) {
        toastRef.current({ kind: "info", title: n.projectName || n.actorName || "اعلان جدید", body: n.text, href: n.link });
      }
    } catch {
      /* offline */
    }
  }, []);

  const refreshSummary = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications?summary=1", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      if (typeof d.unread === "number") {
        if (!primed.current) announceNew();
        else if (d.unread > lastUnread.current) announceNew();
        lastUnread.current = d.unread;
        setUnread(d.unread);
      }
      if (typeof d.chatUnread === "number") setChatUnread(d.chatUnread);
    } catch {
      /* offline */
    }
  }, [announceNew]);

  // counters are not sent with the page (keeps the first response fast): fetch them right after mount
  useEffect(() => {
    if (userId) refreshSummary();
  }, [userId, refreshSummary]);

  // ---- presence heartbeat ("online" dot / "last seen" in chat): once a minute while the tab is visible
  useEffect(() => {
    if (!userId) return undefined;
    function beat() {
      if (document.hidden) return;
      fetch("/api/presence", { method: "POST", keepalive: true }).catch(() => {});
    }
    beat();
    const timer = setInterval(beat, 60000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, [userId]);

  // ---- socket with automatic reconnect
  useEffect(() => {
    if (!userId || POLLING_ONLY) return undefined;
    let ws = null;
    let timer = null;
    let attempt = 0;
    let stopped = false;
    let everOpened = false;

    function setState(next) {
      statusRef.current = next;
      setStatus(next);
    }

    function connect() {
      if (stopped) return;
      setState("connecting");
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      try {
        ws = new WebSocket(`${protocol}://${window.location.host}/ws`);
      } catch {
        schedule();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        setState("open");
        if (everOpened) {
          // we were offline for a while: let listeners catch up
          emit({ type: "reconnected" });
          refreshSummary();
        }
        everOpened = true;
      };
      ws.onmessage = (message) => {
        let event;
        try {
          event = JSON.parse(message.data);
        } catch {
          return;
        }
        if (event.type === "notification") {
          refreshSummary();
          announceNew();
        } else if (event.type === "chat.message" && event.message?.authorId !== userId) {
          refreshSummary();
          // banner unless the chat screen is open (it shows the message itself)
          if (pathRef.current !== "/chat" && !event.message.deleted) {
            toastRef.current({ kind: "chat", title: event.message.authorName, body: event.message.body, href: `/chat?c=${event.conversationId}` });
          }
        }
        emit(event);
      };
      ws.onclose = () => {
        setState("closed");
        schedule();
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      };
    }

    function schedule() {
      if (stopped || timer) return;
      const delay = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
      attempt += 1;
      timer = setTimeout(() => {
        timer = null;
        connect();
      }, delay);
    }

    function onVisible() {
      if (document.hidden) return;
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        attempt = 0;
        connect();
      }
      refreshSummary();
    }

    // keep idle connections alive through proxies
    const keepAlive = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send('{"type":"ping"}');
    }, 25000);

    connect();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    return () => {
      stopped = true;
      clearInterval(keepAlive);
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [userId, emit, refreshSummary, announceNew]);

  // ---- polling fallback while the socket is not open
  useEffect(() => {
    if (!userId || status === "open") return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) refreshSummary();
    }, status === "polling" ? 15000 : 30000);
    return () => clearInterval(timer);
  }, [userId, status, refreshSummary]);

  // in polling mode also refresh when the tab becomes visible again
  useEffect(() => {
    if (!userId || status !== "polling") return undefined;
    function onVisible() {
      if (!document.hidden) refreshSummary();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [userId, status, refreshSummary]);

  // tells the push handler whether in-app banners already cover notifications
  useEffect(() => {
    window.__wkLive = status === "open" ? "ws" : status === "polling" ? "polling" : null;
    return () => {
      window.__wkLive = null;
    };
  }, [status]);

  const value = useMemo(
    () => ({ userId, status, subscribe, unread, setUnread, chatUnread, setChatUnread, refreshSummary }),
    [userId, status, subscribe, unread, chatUnread, refreshSummary]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}
