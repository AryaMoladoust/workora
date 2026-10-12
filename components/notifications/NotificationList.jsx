"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";
import NameAvatar from "../ui/NameAvatar";

export default function NotificationList({ initialItems, unread }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pending, setPending] = useState(unread);

  async function post(body) {
    await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  async function open(item) {
    if (!item.read) {
      setItems((list) => list.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      setPending((c) => Math.max(0, c - 1));
      await post({ ids: [item.id] });
      router.refresh();
    }
    if (item.link) router.push(item.link);
  }

  async function markAll() {
    setItems((list) => list.map((n) => ({ ...n, read: true })));
    setPending(0);
    await post({ all: true });
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2>اعلانی وجود ندارد</h2>
        <p>وقتی وظیفه‌ای به شما سپرده شود یا روی وظایفتان کامنتی گذاشته شود، اینجا می‌بینید.</p>
      </div>
    );
  }

  return (
    <>
      {pending > 0 && (
        <div className="notif-bar">
          <span>{pending.toLocaleString("fa-IR")} اعلان خوانده‌نشده</span>
          <button type="button" className="secondary-button" onClick={markAll}>
            <Icon name="check" size={16} strokeWidth={2.4} />
            خوانده شد برای همه
          </button>
        </div>
      )}
      <ul className="notif-page-list card">
        {items.map((n) => (
          <li key={n.id}>
            <button type="button" className={`notif-item notif-item-lg ${n.read ? "" : "is-unread"}`} onClick={() => open(n)}>
              <span className="notif-avatar">
                <NameAvatar id={n.actorId} name={n.actorName} />
                <span className="feed-badge tone-accent"><Icon name={n.text.icon} size={11} strokeWidth={2.6} /></span>
              </span>
              <span className="notif-text">
                <span><strong>{n.actorName}</strong> {n.text.prefix}<strong>{n.text.title}</strong>{n.text.suffix}</span>
                <small>{n.relative}{n.projectName ? ` · ${n.projectName}` : ""}</small>
              </span>
              {!n.read && <span className="unread-dot" aria-label="خوانده‌نشده" />}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
