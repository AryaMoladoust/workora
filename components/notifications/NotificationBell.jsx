"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";
import NameAvatar from "../ui/NameAvatar";

export default function NotificationBell({ unread, setUnread }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function load() {
    setError("");
    try {
      const r = await fetch("/api/notifications?limit=8");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "دریافت اعلان‌ها انجام نشد.");
      setItems(d.notifications);
      setUnread(d.unread);
    } catch (e) {
      setError(e.message);
      setItems([]);
    }
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  async function markRead(body) {
    const r = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok && typeof d.unread === "number") setUnread(d.unread);
  }

  async function openItem(item) {
    setOpen(false);
    if (!item.read) {
      setItems((list) => list?.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      await markRead({ ids: [item.id] });
    }
    if (item.link) router.push(item.link);
  }

  async function markAll() {
    setItems((list) => list?.map((n) => ({ ...n, read: true })));
    await markRead({ all: true });
    router.refresh();
  }

  return (
    <div className="popover-root" ref={rootRef}>
      <button type="button" className="icon-button bell" aria-label={`اعلان‌ها${unread ? ` (${unread} خوانده‌نشده)` : ""}`} aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
        <Icon name="bell" size={19} />
        {unread > 0 && <span className="bell-badge">{unread > 99 ? "۹۹+" : unread.toLocaleString("fa-IR")}</span>}
      </button>

      {open && (
        <div className="popover notif-popover" role="dialog" aria-label="اعلان‌ها">
          <header className="notif-head">
            <h3>اعلان‌ها</h3>
            {unread > 0 && <button type="button" className="link-button" onClick={markAll}>خوانده شد برای همه</button>}
          </header>

          <div className="notif-body">
            {items === null ? (
              <p className="notif-empty">در حال دریافت...</p>
            ) : error ? (
              <p className="notif-empty">{error}</p>
            ) : items.length === 0 ? (
              <p className="notif-empty">اعلانی ندارید.</p>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button type="button" className={`notif-item ${n.read ? "" : "is-unread"}`} onClick={() => openItem(n)}>
                      <NameAvatar id={n.actorId} name={n.actorName} size="sm" />
                      <span className="notif-text">
                        <span><strong>{n.actorName}</strong> {n.text.prefix}<strong>{n.text.title}</strong>{n.text.suffix}</span>
                        <small>{n.relative}{n.projectName ? ` · ${n.projectName}` : ""}</small>
                      </span>
                      {!n.read && <span className="unread-dot" aria-label="خوانده‌نشده" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="notif-foot">
            <Link href="/notifications" onClick={() => setOpen(false)}>مشاهده همه اعلان‌ها</Link>
          </footer>
        </div>
      )}
    </div>
  );
}
