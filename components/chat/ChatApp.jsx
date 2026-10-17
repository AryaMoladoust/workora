"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import ChatAvatar from "./ChatAvatar";
import ChatThread from "./ChatThread";
import { useRealtime } from "../realtime/RealtimeProvider";

function byRecent(a, b) {
  return (b.lastAt || "").localeCompare(a.lastAt || "");
}

export default function ChatApp({ me, initialProjects, initialDirects, people, initialActiveId }) {
  const { subscribe, status } = useRealtime();
  const [projects, setProjects] = useState(initialProjects);
  const [directs, setDirects] = useState(initialDirects);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [personQuery, setPersonQuery] = useState("");
  const [error, setError] = useState("");

  const all = useMemo(() => [...projects, ...directs], [projects, directs]);
  const active = all.find((c) => c.id === activeId) || null;

  /* keep the address bar in sync without navigating */
  useEffect(() => {
    const url = activeId ? `/chat?c=${activeId}` : "/chat";
    window.history.replaceState(null, "", url);
  }, [activeId]);

  const refreshList = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/conversations", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) return;
      setProjects(d.projects);
      setDirects(d.directs);
    } catch {
      /* offline */
    }
  }, []);

  /* refresh the list periodically: every 8-15 s without a live socket, every 45 s with one (online dots) */
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) refreshList();
    }, status === "open" ? 45000 : status === "polling" ? 8000 : 15000);
    return () => clearInterval(timer);
  }, [status, refreshList]);

  /* live list updates */
  useEffect(
    () =>
      subscribe((event) => {
        if (event.type === "reconnected" || event.type === "chat.deleted") {
          refreshList();
          return;
        }
        if (event.type === "chat.updated") {
          // an edit of the newest message changes the preview
          const m = event.message;
          const patch = (list) => list.map((c) => (c.id === event.conversationId && c.lastAt === m.createdAt ? { ...c, lastPreview: m.body.slice(0, 120) } : c));
          setProjects(patch);
          setDirects(patch);
          return;
        }
        if (event.type !== "chat.message") return;
        const m = event.message;
        const update = (list) => list.map((c) => (c.id === event.conversationId ? bump(c, m) : c));
        const known = all.some((c) => c.id === event.conversationId);
        if (!known) {
          refreshList();
          return;
        }
        setProjects(update);
        setDirects(update);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subscribe, all, refreshList, activeId]
  );

  function bump(entry, message) {
    const mine = message.authorId === me.id;
    const viewing = entry.id === activeId && !document.hidden;
    return {
      ...entry,
      lastPreview: message.deleted ? "" : message.body.slice(0, 120),
      lastMine: mine,
      lastAt: message.createdAt,
      lastRelative: message.timeText || "همین الان",
      unread: mine || viewing ? entry.unread : entry.unread + 1,
    };
  }

  const handleRead = useCallback((id) => {
    const clear = (list) => list.map((c) => (c.id === id && c.unread ? { ...c, unread: 0 } : c));
    setProjects(clear);
    setDirects(clear);
  }, []);

  const handleMuted = useCallback((id, muted) => {
    const set = (list) => list.map((c) => (c.id === id ? { ...c, muted } : c));
    setProjects(set);
    setDirects(set);
  }, []);

  const handleSent = useCallback((message) => {
    const update = (list) => list.map((c) => (c.id === message.conversationId ? bump(c, message) : c));
    setProjects(update);
    setDirects(update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  async function startDirect(person) {
    setError("");
    try {
      const r = await fetch("/api/chat/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.userId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "باز کردن گفتگو انجام نشد.");
      setDirects((list) => (list.some((c) => c.id === d.conversation.id) ? list : [d.conversation, ...list]));
      setActiveId(d.conversation.id);
      setNewOpen(false);
      setPersonQuery("");
    } catch (e) {
      setError(e.message);
    }
  }

  const needle = query.trim().toLowerCase();
  const matches = (c) => !needle || c.title.toLowerCase().includes(needle);
  const shownProjects = [...projects].filter(matches).sort(byRecent);
  const shownDirects = [...directs].filter(matches).sort(byRecent);
  const shownPeople = people.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(personQuery.trim().toLowerCase()));

  function renderRow(c) {
    return (
      <li key={c.id}>
        <button type="button" className={`conv ${c.id === activeId ? "is-active" : ""}`} onClick={() => setActiveId(c.id)}>
          <ChatAvatar id={c.userId || c.projectId || c.id} name={c.title} kind={c.kind} online={Boolean(c.online)} />
          <span className="conv-main">
            <span className="conv-top">
              <strong>{c.title}</strong>
              <small>{c.lastRelative}</small>
            </span>
            <span className="conv-bottom">
              <span className="conv-preview">
                {c.lastPreview ? `${c.lastMine ? "شما: " : ""}${c.lastPreview}` : "هنوز پیامی نیست"}
              </span>
              {c.muted && <Icon name="bellOff" size={13} className="conv-muted" aria-label="بی‌صدا" />}
              {c.unread > 0 && (
                <span className={`conv-badge${c.muted ? " is-muted" : ""}`}>{c.unread > 99 ? "۹۹+" : c.unread.toLocaleString("fa-IR")}</span>
              )}
            </span>
          </span>
        </button>
      </li>
    );
  }

  return (
    <div className={`chat-shell ${active ? "has-active" : ""}`}>
      <aside className="chat-list">
        <div className="chat-list-top">
          <div className="search-field chat-search">
            <Icon name="search" size={18} />
            <input type="search" placeholder="جستجو در گفتگوها..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button type="button" className="chat-new" aria-label="گفتگوی جدید" title="پیام مستقیم جدید" onClick={() => setNewOpen(true)}>
            <Icon name="plus" size={18} />
          </button>
        </div>

        <div className="chat-list-body">
          <section className="chat-card">
            <h3 className="conv-section">گروه‌ها</h3>
            {shownProjects.length ? (
              <ul>{shownProjects.map(renderRow)}</ul>
            ) : (
              <p className="conv-empty">{projects.length ? "موردی پیدا نشد." : "شما عضو هیچ پروژه‌ای نیستید."}</p>
            )}
          </section>

          <section className="chat-card">
            <h3 className="conv-section">افراد</h3>
            {shownDirects.length ? (
              <ul>{shownDirects.map(renderRow)}</ul>
            ) : (
              <p className="conv-empty">
                {directs.length ? "موردی پیدا نشد." : "با دکمه + یک گفتگوی مستقیم شروع کنید."}
              </p>
            )}
          </section>
        </div>
      </aside>

      <div className="chat-main">
        {active ? (
          <ChatThread
            key={active.id}
            conversation={active}
            me={me}
            onBack={() => setActiveId(null)}
            onRead={handleRead}
            onMessage={handleSent}
            onMutedChange={handleMuted}
          />
        ) : (
          <div className="chat-placeholder">
            <span className="coming-soon-icon"><Icon name="chat" size={30} /></span>
            <h2>یک گفتگو را انتخاب کنید</h2>
            <p>از فهرست کنار، چت یکی از پروژه‌ها را باز کنید یا برای یک همکار پیام مستقیم بفرستید.</p>
          </div>
        )}
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="پیام مستقیم جدید" size="sm">
        <div className="search-field" style={{ maxWidth: "none", marginBottom: 12 }}>
          <Icon name="search" size={18} />
          <input type="search" placeholder="جستجوی همکار..." value={personQuery} onChange={(e) => setPersonQuery(e.target.value)} autoFocus />
        </div>
        {error && <div className="form-error" style={{ marginBottom: 10 }}>{error}</div>}
        <ul className="picker-list">
          {shownPeople.map((p) => (
            <li key={p.userId}>
              <button type="button" className="picker-row" onClick={() => startDirect(p)}>
                <ChatAvatar id={p.userId} name={`${p.firstName} ${p.lastName}`} size="sm" />
                <span className="picker-name">{p.firstName} {p.lastName}</span>
              </button>
            </li>
          ))}
          {shownPeople.length === 0 && <li className="field-hint">همکاری پیدا نشد.</li>}
        </ul>
      </Modal>
    </div>
  );
}
