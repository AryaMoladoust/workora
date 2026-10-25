"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import ChatAvatar from "./ChatAvatar";
import ChatThread from "./ChatThread";
import { useRealtime } from "../realtime/RealtimeProvider";

function byRecent(a, b) {
  return (b.lastAt || "").localeCompare(a.lastAt || "");
}

export default function ChatApp({ me, initialProjects, initialGroups = [], initialDirects, people, initialActiveId }) {
  const { subscribe, status } = useRealtime();
  const [projects, setProjects] = useState(initialProjects);
  const [groups, setGroups] = useState(initialGroups);
  const [directs, setDirects] = useState(initialDirects);
  const [activeId, setActiveId] = useState(initialActiveId);
  const [query, setQuery] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [personQuery, setPersonQuery] = useState("");
  const [error, setError] = useState("");
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupPicked, setGroupPicked] = useState([]);
  const [groupQuery, setGroupQuery] = useState("");
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupError, setGroupError] = useState("");

  const all = useMemo(() => [...projects, ...groups, ...directs], [projects, groups, directs]);
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
      setGroups(d.groups || []);
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
        if (event.type === "reconnected" || event.type === "chat.deleted" || event.type === "chat.group") {
          refreshList();
          return;
        }
        if (event.type === "chat.updated") {
          // an edit of the newest message changes the preview
          const m = event.message;
          const patch = (list) => list.map((c) => (c.id === event.conversationId && c.lastAt === m.createdAt ? { ...c, lastPreview: m.body.slice(0, 120) } : c));
          setProjects(patch);
          setGroups(patch);
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
        setGroups(update);
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
    setGroups(clear);
    setDirects(clear);
  }, []);

  const handleMuted = useCallback((id, muted) => {
    const set = (list) => list.map((c) => (c.id === id ? { ...c, muted } : c));
    setProjects(set);
    setGroups(set);
    setDirects(set);
  }, []);

  const handleSent = useCallback((message) => {
    const update = (list) => list.map((c) => (c.id === message.conversationId ? bump(c, message) : c));
    setProjects(update);
    setGroups(update);
    setDirects(update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const handleLeave = useCallback((id) => {
    setGroups((list) => list.filter((c) => c.id !== id));
    setDirects((list) => list.filter((c) => c.id !== id));
    setActiveId(null);
  }, []);

  function openGroupModal() {
    setGroupName("");
    setGroupPicked([]);
    setGroupQuery("");
    setGroupError("");
    setGroupOpen(true);
  }

  function togglePicked(userId) {
    setGroupPicked((list) => (list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId]));
  }

  async function createGroup(e) {
    e.preventDefault();
    if (groupBusy) return;
    setGroupError("");
    if (groupName.trim().length < 2) return setGroupError("نام گروه را وارد کنید (حداقل ۲ کاراکتر).");
    if (!groupPicked.length) return setGroupError("حداقل یک عضو انتخاب کنید.");
    setGroupBusy(true);
    try {
      const r = await fetch("/api/chat/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim(), memberIds: groupPicked }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "ساخت گروه انجام نشد.");
      setGroups((list) => (list.some((c) => c.id === d.conversation.id) ? list : [d.conversation, ...list]));
      setActiveId(d.conversation.id);
      setGroupOpen(false);
    } catch (err) {
      setGroupError(err.message);
    } finally {
      setGroupBusy(false);
    }
  }

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
  const shownGroups = [...groups].filter(matches).sort(byRecent);
  const shownDirects = [...directs].filter(matches).sort(byRecent);
  const groupPeople = people.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(groupQuery.trim().toLowerCase()));
  const shownPeople = people.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(personQuery.trim().toLowerCase()));

  function renderRow(c) {
    return (
      <li key={c.id}>
        <button type="button" className={`conv ${c.id === activeId ? "is-active" : ""}`} onClick={() => setActiveId(c.id)}>
          <ChatAvatar id={c.userId || c.projectId || c.id} name={c.title} kind={c.kind} online={Boolean(c.online)} src={c.avatarUrl} />
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
          <Link href="/dashboard" className="chat-new chat-home" aria-label="بازگشت به برنامه" title="بازگشت به داشبورد">
            <Icon name="dashboard" size={18} />
          </Link>
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
            <h3 className="conv-section">گروه‌های پروژه</h3>
            {shownProjects.length ? (
              <ul>{shownProjects.map(renderRow)}</ul>
            ) : (
              <p className="conv-empty">{projects.length ? "موردی پیدا نشد." : "شما عضو هیچ پروژه‌ای نیستید."}</p>
            )}
          </section>

          <section className="chat-card">
            <h3 className="conv-section conv-section-row">
              <span>گروه‌های من</span>
              <button type="button" className="conv-add" onClick={openGroupModal} aria-label="ساخت گروه جدید" title="ساخت گروه جدید">
                <Icon name="plus" size={14} />
                گروه جدید
              </button>
            </h3>
            {shownGroups.length ? (
              <ul>{shownGroups.map(renderRow)}</ul>
            ) : (
              <p className="conv-empty">{groups.length ? "موردی پیدا نشد." : "با «گروه جدید» یک گروه با همکاران بسازید."}</p>
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
            onLeave={handleLeave}
          />
        ) : (
          <div className="chat-placeholder">
            <span className="coming-soon-icon"><Icon name="chat" size={30} /></span>
            <h2>یک گفتگو را انتخاب کنید</h2>
            <p>از فهرست کنار، چت یکی از پروژه‌ها را باز کنید یا برای یک همکار پیام مستقیم بفرستید.</p>
          </div>
        )}
      </div>

      <Modal open={groupOpen} onClose={() => setGroupOpen(false)} title="ساخت گروه جدید" size="sm">
        <form onSubmit={createGroup}>
          <label className="field-wide">
            <span>نام گروه</span>
            <input type="text" value={groupName} maxLength={80} placeholder="مثلاً تیم طراحی" onChange={(e) => setGroupName(e.target.value)} autoFocus />
          </label>
          <div className="search-field" style={{ maxWidth: "none", margin: "12px 0" }}>
            <Icon name="search" size={18} />
            <input type="search" placeholder="جستجوی همکار..." value={groupQuery} onChange={(e) => setGroupQuery(e.target.value)} />
          </div>
          <p className="field-hint" style={{ marginBottom: 8 }}>{groupPicked.length.toLocaleString("fa-IR")} عضو انتخاب شده (به‌علاوه‌ی شما)</p>
          <ul className="picker-list">
            {groupPeople.map((p) => {
              const on = groupPicked.includes(p.userId);
              return (
                <li key={p.userId}>
                  <button type="button" className={`picker-row${on ? " is-checked" : ""}`} aria-pressed={on} onClick={() => togglePicked(p.userId)}>
                    <ChatAvatar id={p.userId} name={`${p.firstName} ${p.lastName}`} size="sm" src={p.avatarUrl} />
                    <span className="picker-name">{p.firstName} {p.lastName}</span>
                    <span className="picker-check" aria-hidden="true">{on && <Icon name="check" size={14} strokeWidth={3} />}</span>
                  </button>
                </li>
              );
            })}
            {groupPeople.length === 0 && <li className="field-hint">همکاری پیدا نشد.</li>}
          </ul>
          {groupError && <div className="form-error" style={{ marginTop: 10 }}>{groupError}</div>}
          <div className="modal-actions" style={{ marginTop: 14, display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button type="button" className="secondary-button" onClick={() => setGroupOpen(false)}>انصراف</button>
            <button type="submit" className="primary-button" disabled={groupBusy}>{groupBusy ? "در حال ساخت..." : "ساخت گروه"}</button>
          </div>
        </form>
      </Modal>

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
                <ChatAvatar id={p.userId} name={`${p.firstName} ${p.lastName}`} size="sm" src={p.avatarUrl} />
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
