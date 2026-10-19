"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";
import { usePwa } from "../pwa/PwaProvider";
import { NAV_GROUPS, isActivePath } from "./nav";

const faCount = (n) => (n > 99 ? "۹۹+" : n.toLocaleString("fa-IR"));

// Dark floating sidebar: logo on top, grouped links, an expand / collapse switch and round quick buttons at the bottom.
// Collapsed = icon rail; the name of each icon shows as a tooltip on hover.
export default function Sidebar({ pathname, open, onClose, workspace, role, unread = 0, chatUnread = 0, collapsed = false, onToggleCollapse }) {
  const router = useRouter();
  const pwa = usePwa();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await pwa.detachPush();
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const quick = [
    { key: "new", href: "/projects/new", icon: "plus", label: "پروژه جدید" },
    { key: "bell", href: "/notifications", icon: "bell", label: "اعلان‌ها", badge: unread },
    { key: "settings", href: "/settings", icon: "settings", label: "تنظیمات" },
  ];

  return (
    <aside className={`sidebar ${open ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`} aria-label="منوی اصلی">
      <div className="sidebar-top">
        <Link href="/dashboard" className="brand" onClick={onClose} data-tip="Workora">
          <img src="/logo.png" alt="" width="42" height="42" className="brand-mark" />
          <span className="brand-text">
            <strong>Workora</strong>
            <small>{workspace.name}</small>
          </span>
        </Link>
        <button type="button" className="icon-button sidebar-close" aria-label="بستن منو" onClick={onClose}>
          <Icon name="close" size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <span className="nav-group-label">{group.label}</span>
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const badge = item.href === "/notifications" ? unread : item.href === "/chat" ? chatUnread : 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  data-tip={item.label}
                  onClick={onClose}
                >
                  <span className="nav-icon"><Icon name={item.icon} size={19} /></span>
                  <span className="nav-label">{item.label}</span>
                  {badge > 0 && <span className="nav-badge">{faCount(badge)}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="sb-quick" role="group" aria-label="دسترسی سریع">
          {quick.map((q) => (
            <Link key={q.key} href={q.href} className="sb-round" aria-label={q.label} data-tip={q.label} onClick={onClose}>
              <Icon name={q.icon} size={17} />
              {q.badge > 0 && <span className="sb-dot" />}
            </Link>
          ))}
          <button type="button" className="sb-round is-danger" aria-label="خروج از حساب" data-tip="خروج از حساب" onClick={logout} disabled={busy}>
            <Icon name="logout" size={17} />
          </button>
        </div>

        <div className="sidebar-footer" title={role === "owner" ? "شما مالک این فضای کاری هستید" : "عضو فضای کاری"}>
          <span className="sidebar-footer-icon"><Icon name="layers" size={17} /></span>
          <div>
            <strong>{workspace.name}</strong>
            <small>{role === "owner" ? "مالک فضای کاری" : "عضو فضای کاری"}</small>
          </div>
        </div>
        <button
          type="button"
          className="sb-collapse"
          onClick={onToggleCollapse}
          aria-pressed={collapsed}
          aria-label={collapsed ? "باز کردن منو" : "جمع کردن منو"}
          data-tip={collapsed ? "باز کردن منو" : "جمع کردن منو"}
        >
          <Icon name={collapsed ? "chevronsLeft" : "chevronsRight"} size={18} />
          <span className="nav-label">جمع کردن منو</span>
        </button>
      </div>
    </aside>
  );
}
