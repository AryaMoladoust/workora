"use client";

import Link from "next/link";
import Icon from "../ui/Icon";
import { NAV_GROUPS, isActivePath } from "./nav";

export default function Sidebar({ pathname, open, onClose, workspace, role, unread = 0, chatUnread = 0 }) {
  return (
    <aside className={`sidebar ${open ? "is-open" : ""}`} aria-label="منوی اصلی">
      <div className="sidebar-top">
        <Link href="/dashboard" className="brand" onClick={onClose}>
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
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  onClick={onClose}
                >
                  <Icon name={item.icon} size={19} />
                  <span>{item.label}</span>
                  {item.href === "/notifications" && unread > 0 && (
                    <span className="nav-badge">{unread > 99 ? "۹۹+" : unread.toLocaleString("fa-IR")}</span>
                  )}
                  {item.href === "/chat" && chatUnread > 0 && (
                    <span className="nav-badge">{chatUnread > 99 ? "۹۹+" : chatUnread.toLocaleString("fa-IR")}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-footer-icon"><Icon name="layers" size={18} /></span>
        <div>
          <strong>{workspace.name}</strong>
          <small>{role === "owner" ? "شما مالک این فضای کاری هستید" : "عضو فضای کاری"}</small>
        </div>
      </div>
    </aside>
  );
}
