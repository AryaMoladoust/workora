"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Icon from "../ui/Icon";
import ChatAvatar from "./ChatAvatar";
import EmojiPicker from "./EmojiPicker";
import { useRealtime } from "../realtime/RealtimeProvider";
import { dayKey, dayLabel } from "../../lib/format";

const MAX_LENGTH = 4000;
const GROUP_GAP_MS = 5 * 60 * 1000;
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

function mergeMessages(list, incoming) {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Message text with the @mentions highlighted.
function renderBody(body, mentions, meId) {
  if (!mentions?.length) return body;
  const names = [...new Set(mentions.map((m) => m.name))].sort((a, b) => b.length - a.length);
  const re = new RegExp(`@(${names.map(escapeRegex).join("|")})`, "g");
  const parts = [];
  let last = 0;
  let match;
  while ((match = re.exec(body))) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    const mentioned = mentions.find((m) => m.name === match[1]);
    parts.push(
      <span key={`${match.index}-${match[1]}`} className={`mention${mentioned?.id === meId ? " is-me" : ""}`}>
        @{match[1]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

// Search snippet with the searched text highlighted.
function highlight(text, query) {
  const q = query.trim();
  if (!q) return text;
  const re = new RegExp(`(${escapeRegex(q)})`, "ig");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

export default function ChatThread({ conversation, me, embedded = false, onBack, onRead, onMessage, onMutedChange, onLeave }) {
  const { status, subscribe, setChatUnread } = useRealtime();
  const [messages, setMessages] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [detached, setDetached] = useState(false); // showing an old window (jumped to a quote / search result)
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [newBelow, setNewBelow] = useState(false);

  // conversation details
  const [participants, setParticipants] = useState([]);
  const [pins, setPins] = useState([]);
  const [pinIndex, setPinIndex] = useState(0);
  const [muted, setMuted] = useState(Boolean(conversation.muted));
  const [presence, setPresence] = useState({});
  const [reads, setReads] = useState({});

  // composer state
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mention, setMention] = useState(null); // { start, query, index }

  // message UI state
  const [menu, setMenu] = useState(null); // { id, type: "react" | "more", up }
  const [toolsFor, setToolsFor] = useState(null); // touch devices: message whose tool buttons are shown
  const [flashId, setFlashId] = useState(null);

  // search
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState(null); // null = nothing searched yet
  const [searching, setSearching] = useState(false);

  const listRef = useRef(null);
  const innerRef = useRef(null);
  const inputRef = useRef(null);
  const atBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  const instantRef = useRef(true);
  const lastIdRef = useRef(null);
  const jumpRef = useRef(null);
  const readTimer = useRef(null);
  const syncRef = useRef(null); // server time of the last successful sync (to also catch edits / deletions)
  const mentionsRef = useRef(new Map());
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const detachedRef = useRef(detached);
  detachedRef.current = detached;
  // callbacks from the parent may change identity on every render; keep them out of effect deps
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onMutedRef = useRef(onMutedChange);
  onMutedRef.current = onMutedChange;
  const convId = conversation.id;
  const isGroup = conversation.kind === "project" || conversation.kind === "group";

  /* ------------------------------------------------ helpers */
  const applyUpdated = useCallback((m) => {
    setMessages((list) => (list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? { ...x, ...m } : x)) : list));
    setPins((list) => {
      const existing = list.find((p) => p.id === m.id);
      const rest = list.filter((p) => p.id !== m.id);
      const full = { ...existing, ...m };
      if (!full.pinned || full.deleted) return rest;
      if (typeof full.body !== "string" || !full.createdAt) return list; // partial update of a message we do not know
      return [full, ...rest].sort((a, b) => (a.pinnedAt < b.pinnedAt ? 1 : a.pinnedAt > b.pinnedAt ? -1 : 0));
    });
  }, []);

  const mergeReads = useCallback((incoming) => {
    if (!incoming) return;
    setReads((prev) => {
      const next = { ...prev };
      for (const [id, at] of Object.entries(incoming)) if (!next[id] || next[id] < at) next[id] = at;
      return next;
    });
  }, []);

  const refreshMeta = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat/conversations/${convId}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) return;
      setParticipants(d.participants || []);
      setPins(d.pins || []);
      setMuted(Boolean(d.muted));
      setPresence(d.presence || {});
      mergeReads(d.reads);
    } catch {
      /* offline */
    }
  }, [convId, mergeReads]);

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
  const loadLatest = useCallback(async () => {
    setLoading(true);
    setError("");
    setNewBelow(false);
    setDetached(false);
    detachedRef.current = false;
    forceScrollRef.current = true;
    instantRef.current = true;
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages?limit=40`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "دریافت پیام‌ها انجام نشد.");
      setMessages(d.messages);
      setHasMore(d.hasMore);
      mergeReads(d.reads);
      if (d.now) syncRef.current = new Date(new Date(d.now).getTime() - 5000).toISOString();
      scheduleRead();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [convId, mergeReads, scheduleRead]);

  useEffect(() => {
    setMessages([]);
    setPins([]);
    setReads({});
    setPresence({});
    setParticipants([]);
    setReplyTo(null);
    setEditing(null);
    setMenu(null);
    setSearchOpen(false);
    mentionsRef.current = new Map();
    lastIdRef.current = null;
    loadLatest();
    refreshMeta();
    return () => clearTimeout(readTimer.current);
  }, [convId, loadLatest, refreshMeta]);

  const catchUp = useCallback(async () => {
    if (detachedRef.current) return;
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
      for (const u of d.updated || []) applyUpdated(u);
      mergeReads(d.reads);
    } catch {
      /* offline */
    }
  }, [convId, me.id, scheduleRead, applyUpdated, mergeReads]);

  /* ------------------------------------------------ realtime */
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type === "reconnected") {
          catchUp();
          refreshMeta();
          return;
        }
        if (event.conversationId !== convId) return;
        if (event.type === "chat.message") {
          if (!detachedRef.current) setMessages((list) => mergeMessages(list, [event.message]));
          if (event.message.authorId !== me.id) scheduleRead();
        } else if (event.type === "chat.updated") {
          applyUpdated(event.message);
        } else if (event.type === "chat.deleted") {
          applyUpdated({ id: event.messageId, deleted: true, body: "", pinned: false, reactions: [], mentions: [], replyTo: null, edited: false });
        } else if (event.type === "chat.read") {
          if (event.userId !== me.id) mergeReads({ [event.userId]: event.at });
        }
      }),
    [subscribe, convId, me.id, scheduleRead, catchUp, refreshMeta, applyUpdated, mergeReads]
  );

  // polling fallback while the socket is down
  useEffect(() => {
    if (status === "open") return undefined;
    const timer = setInterval(() => {
      if (!document.hidden) catchUp();
    }, status === "polling" ? 3000 : 8000);
    return () => clearInterval(timer);
  }, [status, catchUp]);

  // online dots / last seen / participants change slowly: refresh every 45 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) refreshMeta();
    }, 45000);
    return () => clearInterval(timer);
  }, [refreshMeta]);

  useEffect(() => {
    function onVisible() {
      if (!document.hidden) {
        catchUp();
        scheduleRead();
        refreshMeta();
      }
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [catchUp, scheduleRead, refreshMeta]);

  /* close popovers when clicking elsewhere */
  useEffect(() => {
    function onDown(e) {
      if (e.target.closest?.("[data-pop]")) return;
      setEmojiOpen(false);
      setMenu(null);
      setMention(null);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  /* ------------------------------------------------ scrolling */
  function scrollToMessage(id, { smooth = true } = {}) {
    const el = listRef.current?.querySelector(`[data-mid="${id}"]`);
    if (!el) return false;
    el.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
    setFlashId(id);
    setTimeout(() => setFlashId((cur) => (cur === id ? null : cur)), 1600);
    return true;
  }

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (jumpRef.current) {
      if (scrollToMessage(jumpRef.current.id, { smooth: !jumpRef.current.instant })) jumpRef.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    // nothing to show yet: keep the "jump to the newest message, instantly" flags for the first real batch
    if (!last) return;
    const changed = lastIdRef.current !== last.id;
    lastIdRef.current = last.id;
    if (forceScrollRef.current || atBottomRef.current || (changed && last.authorId === me.id)) {
      if (!detachedRef.current || forceScrollRef.current) {
        el.scrollTo({ top: el.scrollHeight, behavior: instantRef.current ? "instant" : "smooth" });
        atBottomRef.current = true;
        instantRef.current = false;
        forceScrollRef.current = false;
        setNewBelow(false);
      }
    } else if (changed && last) {
      setNewBelow(true);
    }
  }, [messages, me.id]);

  // content height can still change after the first paint (font loading, reactions, quotes): stay on the newest message
  useEffect(() => {
    const el = listRef.current;
    const inner = innerRef.current;
    if (!el || !inner || typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(() => {
      if (atBottomRef.current && !detachedRef.current && !jumpRef.current) el.scrollTop = el.scrollHeight;
    });
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = nearBottom;
    if (nearBottom && !detachedRef.current) setNewBelow(false);
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

  // Scrolls to a message; loads the surrounding messages first when it is not on screen.
  async function jumpTo(id) {
    setMenu(null);
    if (messagesRef.current.some((m) => m.id === id)) {
      scrollToMessage(id);
      return;
    }
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages?around=${encodeURIComponent(id)}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "پیام پیدا نشد.");
      jumpRef.current = { id, instant: true };
      setDetached(Boolean(d.hasNewer));
      setHasMore(d.hasMore);
      mergeReads(d.reads);
      setMessages(d.messages);
    } catch (e) {
      setError(e.message);
    }
  }

  /* ------------------------------------------------ sending / editing */
  async function deliver(tempId, body, extra) {
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, ...extra }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "ارسال پیام انجام نشد.");
      setMessages((list) => list.filter((m) => m.id !== d.message.id).map((m) => (m.id === tempId ? d.message : m)));
      onMessageRef.current?.(d.message);
    } catch (e) {
      setMessages((list) => list.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true, error: e.message, extra } : m)));
    }
  }

  async function saveEdit(body) {
    const target = editing;
    setError("");
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "ویرایش پیام انجام نشد.");
      applyUpdated(d.message);
      setEditing(null);
      setText("");
      resizeInput();
    } catch (e) {
      setError(e.message);
    }
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    if (body.length > MAX_LENGTH) {
      setError(`پیام نباید بیشتر از ${MAX_LENGTH.toLocaleString("fa-IR")} کاراکتر باشد.`);
      return;
    }
    if (editing) {
      saveEdit(body);
      return;
    }
    setError("");
    // sending from an old window (after jumping to a quote / search result): go back to the latest messages first
    if (detachedRef.current) await loadLatest();
    const mentionList = [...mentionsRef.current].filter(([, name]) => body.includes(`@${name}`)).map(([id, name]) => ({ id, name }));
    const extra = { replyToId: replyTo?.id || undefined, mentions: mentionList.map((m) => m.id) };
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    forceScrollRef.current = true;
    instantRef.current = false;
    setMessages((list) => [
      ...list,
      {
        id: tempId,
        conversationId: convId,
        authorId: me.id,
        authorName: me.name,
        body,
        deleted: false,
        pending: true,
        createdAt: new Date().toISOString(),
        dayKey: dayKey(new Date()),
        timeText: "",
        edited: false,
        pinned: false,
        reactions: [],
        mentions: mentionList,
        replyTo: replyTo ? { id: replyTo.id, authorId: replyTo.authorId, authorName: replyTo.authorName, preview: replyTo.body.slice(0, 120) } : null,
      },
    ]);
    setText("");
    setReplyTo(null);
    mentionsRef.current = new Map();
    resizeInput();
    deliver(tempId, body, extra);
  }

  function retry(message) {
    setMessages((list) => list.map((m) => (m.id === message.id ? { ...m, failed: false, pending: true } : m)));
    deliver(message.id, message.body, message.extra);
  }

  async function remove(message, scope = "all") {
    setMenu(null);
    if (message.failed) {
      setMessages((list) => list.filter((m) => m.id !== message.id));
      return;
    }
    const forMe = scope === "me";
    if (!window.confirm(forMe ? "این پیام فقط برای شما پاک شود؟ دیگران همچنان آن را می‌بینند." : "این پیام برای همه حذف شود؟")) return;
    const r = await fetch(`/api/chat/conversations/${convId}/messages/${message.id}${forMe ? "?scope=me" : ""}`, { method: "DELETE" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(d.error || "حذف پیام انجام نشد.");
      return;
    }
    if (forMe) {
      setMessages((list) => list.filter((m) => m.id !== message.id));
      setPins((list) => list.filter((p) => p.id !== message.id));
    } else {
      applyUpdated({ id: message.id, deleted: true, body: "", pinned: false, reactions: [], mentions: [], replyTo: null, edited: false });
    }
  }

  async function leaveGroup() {
    if (!window.confirm("از این گروه خارج می‌شوید و پیام‌های آن را دیگر نمی‌بینید. ادامه می‌دهید؟")) return;
    const r = await fetch(`/api/chat/conversations/${convId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leave: true }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setError(d.error || "خروج از گروه انجام نشد.");
    else onLeave?.(convId);
  }

  /* ------------------------------------------------ message actions */
  async function react(message, emoji) {
    setMenu(null);
    setToolsFor(null);
    const before = message.reactions || [];
    // optimistic: one reaction per person
    const had = before.find((g) => g.userIds.includes(me.id));
    let groups = before.map((g) => ({ ...g, userIds: g.userIds.filter((id) => id !== me.id) }));
    if (!had || had.emoji !== emoji) {
      const target = groups.find((g) => g.emoji === emoji);
      if (target) target.userIds.push(me.id);
      else groups.push({ emoji, userIds: [me.id] });
    }
    groups = groups.filter((g) => g.userIds.length);
    applyUpdated({ id: message.id, reactions: groups, pinned: message.pinned, pinnedAt: message.pinnedAt });
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages/${message.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "ثبت واکنش انجام نشد.");
      applyUpdated(d.message);
    } catch (e) {
      applyUpdated({ id: message.id, reactions: before, pinned: message.pinned, pinnedAt: message.pinnedAt });
      setError(e.message);
    }
  }

  async function togglePin(message) {
    setMenu(null);
    setToolsFor(null);
    try {
      const r = await fetch(`/api/chat/conversations/${convId}/messages/${message.id}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !message.pinned }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "سنجاق کردن انجام نشد.");
      applyUpdated(d.message);
      if (d.message.pinned) setPinIndex(0);
    } catch (e) {
      setError(e.message);
    }
  }

  function startReply(message) {
    setMenu(null);
    setToolsFor(null);
    setEditing(null);
    setReplyTo(message);
    inputRef.current?.focus();
  }

  function startEdit(message) {
    setMenu(null);
    setToolsFor(null);
    setReplyTo(null);
    setEditing(message);
    setText(message.body);
    mentionsRef.current = new Map((message.mentions || []).map((m) => [m.id, m.name]));
    requestAnimationFrame(() => {
      resizeInput();
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    });
  }

  async function copyText(message) {
    setMenu(null);
    setToolsFor(null);
    try {
      await navigator.clipboard.writeText(message.body);
    } catch {
      setError("کپی انجام نشد.");
    }
  }

  function openMenu(message, type, e) {
    e.stopPropagation();
    const row = e.currentTarget.closest(".msg");
    const list = listRef.current;
    let up = true;
    if (row && list) up = row.getBoundingClientRect().top - list.getBoundingClientRect().top > 190;
    setMenu((cur) => (cur && cur.id === message.id && cur.type === type ? null : { id: message.id, type, up }));
  }

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    try {
      const r = await fetch(`/api/chat/conversations/${convId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: next }),
      });
      if (!r.ok) throw new Error();
      onMutedRef.current?.(convId, next);
    } catch {
      setMuted(!next);
      setError("تغییر وضعیت بی‌صدا انجام نشد.");
    }
  }

  /* ------------------------------------------------ composer helpers */
  function resizeInput() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 150)}px`;
  }

  function insertAtCaret(value) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + value + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + value.length;
      el.setSelectionRange(pos, pos);
      resizeInput();
    });
  }

  const mentionItems = useMemo(() => {
    if (!mention || !isGroup) return [];
    const q = mention.query.trim().toLowerCase();
    return participants.filter((p) => p.id !== me.id && p.name.toLowerCase().includes(q)).slice(0, 6);
  }, [mention, isGroup, participants, me.id]);

  function detectMention(value, caret) {
    if (!isGroup) return;
    const before = value.slice(0, caret);
    const m = /(?:^|\s)@([^\s@]{0,30})$/.exec(before);
    if (!m) {
      setMention(null);
      return;
    }
    setMention({ start: caret - m[1].length - 1, query: m[1], index: 0 });
  }

  function pickMention(person) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? text.length;
    const insert = `@${person.name} `;
    const next = text.slice(0, mention.start) + insert + text.slice(caret);
    mentionsRef.current.set(person.id, person.name);
    setText(next);
    setMention(null);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = mention.start + insert.length;
      el.setSelectionRange(pos, pos);
      resizeInput();
    });
  }

  function onKeyDown(e) {
    if (mention && mentionItems.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        setMention((m) => ({ ...m, index: (m.index + dir + mentionItems.length) % mentionItems.length }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pickMention(mentionItems[Math.min(mention.index, mentionItems.length - 1)]);
        return;
      }
    }
    if (e.key === "Escape") {
      if (mention) setMention(null);
      else if (emojiOpen) setEmojiOpen(false);
      else if (editing) {
        setEditing(null);
        setText("");
        resizeInput();
      } else if (replyTo) setReplyTo(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  /* ------------------------------------------------ search */
  useEffect(() => {
    if (!searchOpen) return undefined;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/chat/conversations/${convId}/messages?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const d = await r.json();
        if (alive && r.ok) setResults(d.results || []);
      } catch {
        /* offline */
      } finally {
        if (alive) setSearching(false);
      }
    }, 300);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [searchQuery, searchOpen, convId]);

  function closeSearch() {
    setSearchOpen(false);
    setSearchQuery("");
    setResults(null);
  }

  /* ------------------------------------------------ derived data */
  const people = useMemo(() => new Map(participants.map((p) => [p.id, p.name])), [participants]);
  const readTimes = useMemo(() => Object.entries(reads).filter(([id]) => id !== me.id).map(([, at]) => at), [reads, me.id]);
  const isSeen = (m) => readTimes.some((at) => at >= m.createdAt);

  const items = [];
  let prev = null;
  for (const m of messages) {
    const newDay = !prev || prev.dayKey !== m.dayKey;
    const grouped = !newDay && prev.authorId === m.authorId && !prev.deleted && new Date(m.createdAt) - new Date(prev.createdAt) < GROUP_GAP_MS;
    if (newDay) items.push({ kind: "day", key: `d-${m.dayKey}-${m.id}`, label: dayLabel(m.dayKey) });
    items.push({ kind: "msg", key: m.id, message: m, grouped, groupedNext: false });
    prev = m;
  }
  for (let i = 0; i < items.length - 1; i += 1) {
    if (items[i].kind === "msg" && items[i + 1].kind === "msg" && items[i + 1].grouped) items[i].groupedNext = true;
  }

  const currentPin = pins.length ? pins[pinIndex % pins.length] : null;
  const otherPresence = !isGroup && conversation.userId ? presence[conversation.userId] : null;
  const onlineCount = isGroup ? Object.values(presence).filter((p) => p.online).length + 1 : 0; // + me
  let subtitle;
  if (isGroup) {
    subtitle = participants.length
      ? `${participants.length.toLocaleString("fa-IR")} عضو · ${onlineCount.toLocaleString("fa-IR")} آنلاین`
      : conversation.kind === "group" ? "گروه" : "گفتگوی گروهی پروژه";
  } else if (otherPresence?.online) {
    subtitle = "آنلاین";
  } else if (otherPresence?.lastSeenText) {
    subtitle = `آخرین بازدید ${otherPresence.lastSeenText}`;
  } else {
    subtitle = "پیام مستقیم";
  }

  /* ------------------------------------------------ render */
  return (
    <section className={`thread ${embedded ? "thread-embedded" : ""}`}>
      <header className="thread-head">
        {onBack && (
          <button type="button" className="icon-button thread-back" aria-label="بازگشت به فهرست" onClick={onBack}>
            <Icon name="arrowLeft" size={18} />
          </button>
        )}
        <ChatAvatar id={conversation.userId || conversation.projectId || conversation.id} name={conversation.title} kind={conversation.kind} size="lg" online={Boolean(otherPresence?.online)} />
        <div className="thread-title">
          <strong>{conversation.title}</strong>
          <small className={otherPresence?.online ? "is-online" : ""}>
            {isGroup && conversation.projectId ? <Link href={`/projects/${conversation.projectId}`}>{subtitle}</Link> : subtitle}
          </small>
        </div>
        {status !== "open" && status !== "polling" && (
          <span className="conn-badge" title="اتصال زنده برقرار نیست؛ پیام‌ها هر چند ثانیه به‌روز می‌شوند.">
            <span className="conn-dot" />
            {status === "connecting" ? "در حال اتصال..." : "بدون اتصال زنده"}
          </span>
        )}
        <button type="button" className={`thread-action${searchOpen ? " is-on" : ""}`} aria-label="جستجو در پیام‌ها" title="جستجو در پیام‌ها" onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}>
          <Icon name="search" size={18} />
        </button>
        <button type="button" className={`thread-action${muted ? " is-on" : ""}`} aria-label={muted ? "برداشتن حالت بی‌صدا" : "بی‌صدا کردن گفتگو"} aria-pressed={muted} title={muted ? "بی‌صدا است؛ برای فعال کردن اعلان‌ها بزنید" : "بی‌صدا کردن گفتگو"} onClick={toggleMute}>
          <Icon name={muted ? "bellOff" : "bell"} size={18} />
        </button>
        {conversation.kind === "group" && (
          <button type="button" className="thread-action" aria-label="خروج از گروه" title="خروج از گروه" onClick={leaveGroup}>
            <Icon name="logout" size={18} />
          </button>
        )}
      </header>

      {searchOpen && (
        <div className="thread-search">
          <div className="thread-search-field">
            <Icon name="search" size={17} />
            <input
              type="search"
              autoFocus
              value={searchQuery}
              placeholder="جستجو در متن پیام‌های این گفتگو..."
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && closeSearch()}
            />
            <button type="button" className="thread-search-close" aria-label="بستن جستجو" onClick={closeSearch}>
              <Icon name="close" size={16} />
            </button>
          </div>
          {searchQuery.trim().length >= 2 && (
            <div className="search-results">
              {searching && !results && <p className="search-note">در حال جستجو...</p>}
              {results && results.length === 0 && <p className="search-note">نتیجه‌ای پیدا نشد.</p>}
              {results?.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="search-hit"
                  onClick={() => {
                    closeSearch();
                    jumpTo(m.id);
                  }}
                >
                  <span className="search-hit-top">
                    <strong>{m.authorId === me.id ? "شما" : m.authorName}</strong>
                    <small>{dayLabel(m.dayKey)} · {m.timeText}</small>
                  </span>
                  <span className="search-hit-text">{highlight(m.body, searchQuery)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {currentPin && (
        <div className="pin-bar">
          <button type="button" className="pin-bar-main" onClick={() => { jumpTo(currentPin.id); setPinIndex((i) => i + 1); }}>
            <Icon name="pin" size={16} />
            <span className="pin-bar-text">
              <small>
                پیام سنجاق‌شده{pins.length > 1 ? ` (${((pinIndex % pins.length) + 1).toLocaleString("fa-IR")} از ${pins.length.toLocaleString("fa-IR")})` : ""}
              </small>
              <span>{currentPin.body}</span>
            </span>
          </button>
          <button type="button" className="pin-bar-close" aria-label="برداشتن سنجاق" title="برداشتن سنجاق" onClick={() => togglePin(currentPin)}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      <div className="thread-list" ref={listRef} onScroll={onScroll}>
        <div className="thread-inner" ref={innerRef}>
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
                  groupedNext={item.groupedNext}
                  mine={item.message.authorId === me.id}
                  meId={me.id}
                  showName={isGroup}
                  seen={item.message.authorId === me.id && isSeen(item.message)}
                  people={people}
                  menu={menu && menu.id === item.message.id ? menu : null}
                  toolsOn={toolsFor === item.message.id}
                  flash={flashId === item.message.id}
                  onToggleTools={() => setToolsFor((cur) => (cur === item.message.id ? null : item.message.id))}
                  onOpenMenu={openMenu}
                  onReact={react}
                  onReply={startReply}
                  onEdit={startEdit}
                  onPin={togglePin}
                  onCopy={copyText}
                  onDelete={remove}
                  onRetry={retry}
                  onJump={jumpTo}
                />
              )
            )}
          </>
        )}
        </div>
        {(newBelow || detached) && (
          <button
            type="button"
            className="jump-down"
            onClick={() => {
              if (detached) {
                loadLatest();
                return;
              }
              listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
              setNewBelow(false);
            }}
          >
            <Icon name="arrowDown" size={16} />
            {detached ? "رفتن به آخرین پیام‌ها" : "پیام جدید"}
          </button>
        )}
      </div>

      {error && (
        <div className="form-error thread-error" role="alert">
          {error}
          <button type="button" className="thread-error-close" aria-label="بستن" onClick={() => setError("")}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {(replyTo || editing) && (
          <div className="composer-ctx">
            <Icon name={editing ? "pencil" : "reply"} size={16} />
            <span className="composer-ctx-text">
              <strong>{editing ? "ویرایش پیام" : `پاسخ به ${replyTo.authorId === me.id ? "خودتان" : replyTo.authorName}`}</strong>
              <span>{(editing || replyTo).body}</span>
            </span>
            <button
              type="button"
              aria-label="لغو"
              onClick={() => {
                if (editing) {
                  setText("");
                  resizeInput();
                }
                setEditing(null);
                setReplyTo(null);
              }}
            >
              <Icon name="close" size={15} />
            </button>
          </div>
        )}

        <div className="composer-box">
          {mention && mentionItems.length > 0 && (
            <ul className="mention-pop" data-pop role="listbox" aria-label="منشن">
              {mentionItems.map((p, i) => (
                <li key={p.id}>
                  <button type="button" role="option" aria-selected={i === mention.index} className={i === mention.index ? "is-active" : ""} onMouseDown={(e) => e.preventDefault()} onClick={() => pickMention(p)}>
                    <ChatAvatar id={p.id} name={p.name} size="sm" online={Boolean(presence[p.id]?.online)} />
                    <span>{p.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {emojiOpen && (
            <EmojiPicker
              onPick={(emoji) => {
                insertAtCaret(emoji);
              }}
            />
          )}
          <button type="button" data-pop className={`composer-emoji${emojiOpen ? " is-on" : ""}`} aria-label="ایموجی" aria-expanded={emojiOpen} onClick={() => setEmojiOpen((v) => !v)}>
            <Icon name="smile" size={21} />
          </button>
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={MAX_LENGTH + 200}
            placeholder={isGroup ? "پیام بنویسید... (با @ همکاری را منشن کنید)" : "پیام بنویسید..."}
            onChange={(e) => {
              setText(e.target.value);
              detectMention(e.target.value, e.target.selectionStart);
              resizeInput();
            }}
            onKeyDown={onKeyDown}
            onClick={(e) => detectMention(e.currentTarget.value, e.currentTarget.selectionStart)}
          />
          <button className="composer-send" disabled={!text.trim()} aria-label={editing ? "ذخیره ویرایش" : "ارسال"}>
            <Icon name={editing ? "check" : "send"} size={18} className={editing ? "" : "icon-flip"} />
          </button>
        </div>
      </form>
    </section>
  );
}

function Ticks({ message, seen }) {
  if (message.pending) return <Icon name="clock" size={12} className="tick tick-pending" />;
  if (message.failed) return null;
  return seen ? (
    <Icon name="checks" size={15} strokeWidth={2.2} className="tick tick-seen" aria-label="خوانده شد" />
  ) : (
    <Icon name="check" size={13} strokeWidth={2.4} className="tick" aria-label="ارسال شد" />
  );
}

const SWIPE_TRIGGER = 64; // px the finger must travel to the right to start a reply
const SWIPE_MAX = 90;

function Message({
  message, grouped, groupedNext, mine, meId, showName, seen, people, menu, toolsOn, flash,
  onToggleTools, onOpenMenu, onReact, onReply, onEdit, onPin, onCopy, onDelete, onRetry, onJump,
}) {
  const bubbleRef = useRef(null);
  const swipeRef = useRef(null);
  const swipedRef = useRef(false);

  // Swipe a message to the right (touch) to reply to it. Vertical scrolling stays untouched.
  function paint(dx, animate) {
    const el = bubbleRef.current;
    if (!el) return;
    const progress = Math.min(1, dx / SWIPE_TRIGGER);
    // own messages sit at the right edge, so they only "nudge"; the arrow still shows the progress
    const shift = mine ? Math.min(dx, SWIPE_MAX) * 0.07 : Math.min(dx, SWIPE_MAX) * 0.8;
    el.style.transition = animate ? "transform .22s cubic-bezier(.2,.8,.2,1)" : "none";
    el.style.transform = dx ? `translateX(${shift}px)` : "";
    el.style.setProperty("--sp", String(progress));
    el.classList.toggle("is-swipe-ready", progress >= 1);
  }

  function swipeStart(e) {
    if (e.pointerType === "mouse" || e.target.closest("button, a, textarea, input")) return;
    swipeRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, locked: false, ready: false };
  }

  function swipeMove(e) {
    const s = swipeRef.current;
    if (!s || e.pointerId !== s.id) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (!s.locked) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        swipeRef.current = null; // it is a scroll, not a swipe
        return;
      }
      if (dx > 10 && dx > Math.abs(dy) * 1.4) {
        s.locked = true;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
      } else {
        return;
      }
    }
    s.dx = Math.max(0, dx);
    if (!s.ready && s.dx >= SWIPE_TRIGGER) {
      s.ready = true;
      try { navigator.vibrate?.(12); } catch { /* not supported */ }
    } else if (s.ready && s.dx < SWIPE_TRIGGER) {
      s.ready = false;
    }
    paint(s.dx, false);
  }

  function swipeEnd(e, cancelled) {
    const s = swipeRef.current;
    if (!s || e.pointerId !== s.id) return;
    swipeRef.current = null;
    if (!s.locked) return;
    swipedRef.current = true; // the click that follows the gesture must not open the tool buttons
    setTimeout(() => { swipedRef.current = false; }, 350);
    paint(0, true);
    if (!cancelled && s.dx >= SWIPE_TRIGGER) onReply(message);
  }

  const cls = `msg ${mine ? "is-mine" : ""} ${grouped ? "is-grouped" : ""} ${groupedNext ? "is-grouped-next" : ""} ${flash ? "is-flash" : ""}`;

  if (message.deleted) {
    return (
      <div className={cls} data-mid={message.id}>
        <div className="bubble bubble-deleted">این پیام حذف شد</div>
      </div>
    );
  }

  const settled = !message.pending && !message.failed;
  const myReaction = (message.reactions || []).find((g) => g.userIds.includes(meId))?.emoji;

  return (
    <div className={`${cls} ${message.pending ? "is-pending" : ""} ${toolsOn || menu ? "is-tools" : ""}`} data-mid={message.id}>
      {!mine && <span className="msg-avatar">{!groupedNext && <ChatAvatar id={message.authorId} name={message.authorName} size="sm" />}</span>}
      <div className="msg-col">
        {!mine && showName && !grouped && <small className="msg-author">{message.authorName}</small>}
        <div className="bubble-wrap">
          <div
            ref={bubbleRef}
            className={`bubble ${message.failed ? "bubble-failed" : ""} ${settled ? "is-swipeable" : ""}`}
            onPointerDown={settled ? swipeStart : undefined}
            onPointerMove={settled ? swipeMove : undefined}
            onPointerUp={settled ? (e) => swipeEnd(e, false) : undefined}
            onPointerCancel={settled ? (e) => swipeEnd(e, true) : undefined}
            onClick={(e) => {
              if (!settled || swipedRef.current || e.target.closest("button, a")) return;
              if (window.matchMedia("(hover: none)").matches) onToggleTools();
            }}
          >
            {settled && (
              <span className="swipe-reply" aria-hidden="true">
                <Icon name="reply" size={16} />
              </span>
            )}
            {message.replyTo && (
              <button type="button" className="quote" onClick={() => onJump(message.replyTo.id)} title="رفتن به پیام اصلی">
                <strong>{message.replyTo.authorId === meId ? "شما" : message.replyTo.authorName}</strong>
                <span>{message.replyTo.preview}</span>
              </button>
            )}
            <p>{renderBody(message.body, message.mentions, meId)}</p>
            <span className="bubble-meta">
              {message.pinned && <Icon name="pin" size={12} className="bubble-pin" aria-label="سنجاق‌شده" />}
              {message.edited && <em className="edited">ویرایش‌شده</em>}
              <span>{message.pending ? "در حال ارسال..." : message.failed ? "ارسال نشد" : message.timeText}</span>
              {mine && <Ticks message={message} seen={seen} />}
            </span>
          </div>

          {settled && (
            <div className="msg-tools" data-pop>
              <button type="button" aria-label="واکنش" title="واکنش" onClick={(e) => onOpenMenu(message, "react", e)}><Icon name="smile" size={16} /></button>
              <button type="button" aria-label="پاسخ" title="پاسخ" onClick={() => onReply(message)}><Icon name="reply" size={16} /></button>
              <button type="button" aria-label="بیشتر" title="بیشتر" onClick={(e) => onOpenMenu(message, "more", e)}><Icon name="dots" size={16} /></button>
            </div>
          )}

          {menu?.type === "react" && (
            <div className={`msg-pop react-bar ${menu.up ? "up" : "down"}`} data-pop>
              {QUICK_REACTIONS.map((emoji) => (
                <button key={emoji} type="button" className={emoji === myReaction ? "is-mine" : ""} onClick={() => onReact(message, emoji)}>{emoji}</button>
              ))}
            </div>
          )}
          {menu?.type === "more" && (
            <div className={`msg-pop msg-menu ${menu.up ? "up" : "down"}`} data-pop role="menu">
              <button type="button" role="menuitem" onClick={() => onReply(message)}><Icon name="reply" size={16} />پاسخ</button>
              <button type="button" role="menuitem" onClick={() => onCopy(message)}><Icon name="copy" size={16} />کپی متن</button>
              <button type="button" role="menuitem" onClick={() => onPin(message)}><Icon name="pin" size={16} />{message.pinned ? "برداشتن سنجاق" : "سنجاق کردن"}</button>
              {mine && <button type="button" role="menuitem" onClick={() => onEdit(message)}><Icon name="pencil" size={16} />ویرایش</button>}
              <button type="button" role="menuitem" className="is-danger" onClick={() => onDelete(message, "me")}><Icon name="trash" size={16} />حذف برای من</button>
              {mine && <button type="button" role="menuitem" className="is-danger" onClick={() => onDelete(message, "all")}><Icon name="trash" size={16} />حذف برای همه</button>}
            </div>
          )}
        </div>

        {message.reactions?.length > 0 && (
          <div className="reactions">
            {message.reactions.map((g) => {
              const names = g.userIds.map((id) => (id === meId ? "شما" : people.get(id) || "کاربر")).join("، ");
              return (
                <button key={g.emoji} type="button" className={`reaction ${g.userIds.includes(meId) ? "is-mine" : ""}`} title={names} onClick={() => onReact(message, g.emoji)}>
                  <span>{g.emoji}</span>
                  <small>{g.userIds.length.toLocaleString("fa-IR")}</small>
                </button>
              );
            })}
          </div>
        )}

        {message.failed && (
          <span className="msg-actions failed">
            <button type="button" onClick={() => onRetry(message)}>تلاش دوباره</button>
            <button type="button" onClick={() => onDelete(message)}>حذف</button>
          </span>
        )}
      </div>
    </div>
  );
}
