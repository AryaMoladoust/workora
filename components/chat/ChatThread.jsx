"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Icon from "../ui/Icon";
import NameAvatar from "../ui/NameAvatar";
import { useRealtime } from "../realtime/RealtimeProvider";
import { dayKey, dayLabel } from "../../lib/format";

const MAX_LENGTH = 4000;
const GROUP_GAP_MS = 5 * 60 * 1000;

function mergeMessages(list, incoming) {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

export default function ChatThread({ conversation, me, embedded = false, onBack, onRead, onMessage }) {
  const { status, subscribe, setChatUnread } = useRealtime();
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [newBelow, setNewBelow] = useState(false);

  const listRef = useRef(null);
  const atBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  const readTimer = useRef(null);
  const syncRef = useRef(null); // server time of the last successful sync (to also catch deletions)
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  // callbacks from the parent may change identity on every render; keep them out of effect deps
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const convId = conversation.id;

  /* ------------------------------------------------ read receipts */
  const sendRead = useCallback(async () => {
    if (document.hidden) return;
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/read`, { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        if (typeof d.unread === "number") setChatUnread(d.unread);
        onReadRef.current?.(convId);
      }
    } catch {
      /* offline */
    }
  }, [convId, setChatUnread]);

  const scheduleRead = useCallback(() => {
    clearTimeout(readTimer.current);
    readTimer.current = setTimeout(sendRead, 350);
  }, [sendRead]);

  /* ------------------------------------------------ loading */
  useEffect(() => {
    let alive = true;
    setMessages([]);
    setLoading(true);
    setError("");
    setNewBelow(false);
    forceScrollRef.current = true;
    fetch(`/api/chat/conversations/${convId}/messages?limit=40`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "دریافت پیام‌ها انجام نشد.");
        if (!alive) return;
        setMessages(d.messages);
        setHasMore(d.hasMore);
        if (d.now) syncRef.current = new Date(new Date(d.now).getTime() - 5000).toISOString();
        scheduleRead();
      })
      .catch((e) => alive && setError(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      clearTimeout(readTimer.current);
    };
  }, [convId, scheduleRead]);

  const catchUp = useCallback(async () => {
    const real = messagesRef.current.filter((m) => !m.pending && !m.failed);
    const last = real[real.length - 1];
    const params = new URLSearchParams();
    if (last) params.set("after", last.createdAt);
    else params.set("limit", "40");
    if (syncRef.current) params.set("since", syncRef.current);
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages?${params}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) return;
      if (d.now) syncRef.current = new Date(new Date(d.now).getTime() - 5000).toISOString();
      if (d.messages?.length) {
        setMessages((list) => mergeMessages(list, d.messages));
        if (d.messages.some((m) => m.authorId !== me.id)) scheduleRead();
      }
      if (d.deleted?.length) {
        const gone = new Set(d.deleted);
        setMessages((list) => list.map((m) => (gone.has(m.id) ? { ...m, deleted: true, body: "" } : m)));
      }
    } catch {
      /* offline */
    }
  }, [convId, me.id, scheduleRead]);

  /* ------------------------------------------------ realtime */
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type === "chat.message" && event.conversationId === convId) {
          setMessages((list) => mergeMessages(list, [event.message]));
          if (event.message.authorId !== me.id) scheduleRead();
        } else if (event.type === "chat.deleted" && event.conversationId === convId) {
          setMessages((list) => list.map((m) => (m.id === event.messageId ? { ...m, deleted: true, body: "" } : m)));
        } else if (event.type === "reconnected") {
          catchUp();
        }
      }),
    [subscribe, convId, me.id, scheduleRead, catchUp]
  );

  // polling fallback while the socket is down
  useEffect(() => {
    if (status === "open") return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) catchUp();
    }, status === "polling" ? 3000 : 8000);
    return () => clearInterval(timer);
  }, [status, catchUp]);

  useEffect(() => {
    function onVisible() {
      if (!document.hidden) {
        catchUp();
        scheduleRead();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [catchUp, scheduleRead]);

  /* ------------------------------------------------ scrolling */
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    if (forceScrollRef.current || atBottomRef.current || last?.authorId === me.id) {
      el.scrollTop = el.scrollHeight;
      forceScrollRef.current = false;
      setNewBelow(false);
    } else if (last) {
      setNewBelow(true);
    }
  }, [messages, me.id]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = nearBottom;
    if (nearBottom) setNewBelow(false);
  }

  async function loadOlder() {
    const first = messages.find((m) => !m.pending);
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    const el = listRef.current;
    const before = el ? el.scrollHeight : 0;
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages?limit=40&before=${encodeURIComponent(first.createdAt)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "دریافت پیام‌های قبلی انجام نشد.");
      setMessages((list) => mergeMessages(list, d.messages));
      setHasMore(d.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - before;
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingOlder(false);
    }
  }

  /* ------------------------------------------------ sending */
  async function deliver(tempId, body) {
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "ارسال پیام انجام نشد.");
      setMessages((list) => list.filter((m) => m.id !== d.message.id).map((m) => (m.id === tempId ? d.message : m)));
      onMessageRef.current?.(d.message);
    } catch (e) {
      setMessages((list) => list.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true, error: e.message } : m)));
    }
  }

  function send() {
    const body = text.trim();
    if (!body) return;
    if (body.length > MAX_LENGTH) {
      setError(`پیام نباید بیشتر از ${MAX_LENGTH.toLocaleString("fa-IR")} کاراکتر باشد.`);
      return;
    }
    setError("");
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    forceScrollRef.current = true;
    setMessages((list) => [
      ...list,
      { id: tempId, conversationId: convId, authorId: me.id, authorName: me.name, body, deleted: false, pending: true, createdAt: new Date().toISOString(), dayKey: dayKey(new Date()), timeText: "" },
    ]);
    setText("");
    deliver(tempId, body);
  }

  function retry(message) {
    setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, failed: false, pending: true } : m)));
    deliver(message.id, message.body);
  }

  async function remove(message) {
    if (message.failed) {
      setMessages((list) => list.filter((m) => m.id !== message.id));
      return;
    }
    if (!window.confirm("این پیام حذف شود؟")) return;
    const r = await fetch(`/api/chat/conversations/${convId}/messages/${message.id}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setError(d.error || "حذف پیام انجام نشد.");
    else setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, deleted: true, body: "" } : m)));
  }

  /* ------------------------------------------------ render */
  const items = [];
  let prev = null;
  for (const m of messages) {
    const newDay = !prev || prev.dayKey !== m.dayKey;
    const grouped =
      !newDay && prev.authorId === m.authorId && new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_GAP_MS;
    if (newDay) items.push({ kind: "day", key: `d-${m.dayKey}-${m.id}`, label: dayLabel(m.dayKey) });
    items.push({ kind: "msg", key: m.id, message: m, grouped });
    prev = m;
  }

  const showNames = conversation.kind === "project";

  return (
    <section className={`thread ${embedded ? "thread-embedded" : ""}`}>
      <header className="thread-head">
        {onBack && (
          <button type="button" className="icon-button thread-back" aria-label="بازگشت به فهرست" onClick={onBack}>
            <Icon name="arrowLeft" size={18} />
          </button>
        )}
        <span className="thread-icon">
          {conversation.kind === "project" ? <Icon name="folder" size={19} /> : <NameAvatar id={conversation.userId} name={conversation.title} />}
        </span>
        <div className="thread-title">
          <strong>{conversation.title}</strong>
          <small>
            {conversation.kind === "project" ? (
              <Link href={`/projects/${conversation.projectId}`}>گفتگوی گروهی پروژه</Link>
            ) : (
              "پیام مستقیم"
            )}
          </small>
        </div>
        {status !== "open" && status !== "polling" && (
          <span className="conn-badge" title="اتصال زنده برقرار نیست؛ پیام‌ها هر چند ثانیه به‌روز می‌شوند.">
            <span className="conn-dot" />
            {status === "connecting" ? "در حال اتصال..." : "بدون اتصال زنده"}
          </span>
        )}
      </header>

      <div className="thread-list" ref={listRef} onScroll={onScroll}>
        {loading ? (
          <p className="thread-note">در حال دریافت پیام‌ها...</p>
        ) : (
          <>
            {hasMore && (
              <button type="button" className="link-button thread-older" onClick={loadOlder} disabled={loadingOlder}>
                {loadingOlder ? "در حال دریافت..." : "پیام‌های قدیمی‌تر"}
              </button>
            )}
            {messages.length === 0 && !error && (
              <div className="thread-empty">
                <span className="empty-inline-icon"><Icon name="chat" size={22} /></span>
                <strong>هنوز پیامی نیست</strong>
                <p>اولین پیام را بفرستید.</p>
              </div>
            )}
            {items.map((item) =>
              item.kind === "day" ? (
                <div className="day-sep" key={item.key}><span>{item.label}</span></div>
              ) : (
                <Message
                  key={item.key}
                  message={item.message}
                  grouped={item.grouped}
                  mine={item.message.authorId === me.id}
                  showName={showNames}
                  onDelete={remove}
                  onRetry={retry}
                />
              )
            )}
          </>
        )}
        {newBelow && (
          <button
            type="button"
            className="jump-down"
            onClick={() => {
              const el = listRef.current;
              if (el) el.scrollTop = el.scrollHeight;
              setNewBelow(false);
            }}
          >
            <Icon name="chevronDown" size={16} />
            پیام جدید
          </button>
        )}
      </div>

      {error && <div className="form-error thread-error">{error}</div>}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          rows={1}
          value={text}
          maxLength={MAX_LENGTH + 200}
          placeholder="پیام بنویسید... (Enter برای ارسال، Shift+Enter برای خط جدید)"
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
              e.currentTarget.style.height = "auto";
            }
          }}
        />
        <button className="primary-button composer-send" disabled={!text.trim()} aria-label="ارسال">
          <Icon name="send" size={18} />
        </button>
      </form>
    </section>
  );
}

function Message({ message, grouped, mine, showName, onDelete, onRetry }) {
  if (message.deleted) {
    return (
      <div className={`msg ${mine ? "is-mine" : ""} ${grouped ? "is-grouped" : ""}`}>
        <div className="bubble bubble-deleted">این پیام حذف شد</div>
      </div>
    );
  }
  return (
    <div className={`msg ${mine ? "is-mine" : ""} ${grouped ? "is-grouped" : ""} ${message.pending ? "is-pending" : ""}`}>
      {!mine && (
        <span className="msg-avatar">{!grouped && <NameAvatar id={message.authorId} name={message.authorName} size="sm" />}</span>
      )}
      <div className="msg-col">
        {!mine && showName && !grouped && <small className="msg-author">{message.authorName}</small>}
        <div className={`bubble ${message.failed ? "bubble-failed" : ""}`}>
          <p>{message.body}</p>
          <span className="bubble-meta">
            {message.pending ? "در حال ارسال..." : message.failed ? "ارسال نشد" : message.timeText}
          </span>
        </div>
        {message.failed && (
          <span className="msg-actions failed">
            <button type="button" onClick={() => onRetry(message)}>تلاش دوباره</button>
            <button type="button" onClick={() => onDelete(message)}>حذف</button>
          </span>
        )}
      </div>
      {mine && !message.pending && !message.failed && (
        <button type="button" className="msg-delete" aria-label="حذف پیام" title="حذف پیام" onClick={() => onDelete(message)}>
          <Icon name="close" size={14} />
        </button>
      )}
    </div>
  );
}
