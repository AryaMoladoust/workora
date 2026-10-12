"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";
import PwaControls from "../pwa/PwaControls";
import { usePwa } from "../pwa/PwaProvider";
import { BOTTOM_NAV_ITEMS, ACCOUNT_PATHS, isActivePath } from "./nav";
import { initials, hueFromString } from "../../lib/format";

function faCount(n) {
  return n > 99 ? "۹۹+" : n.toLocaleString("fa-IR");
}

export default function BottomNav({ pathname, user, role, unread = 0, chatUnread = 0, onOpenMenu }) {
  const router = useRouter();
  const pwa = usePwa();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const sheetRef = useRef(null);

  // Close the sheet whenever the route changes.
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sheetOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setSheetOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    sheetRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen]);

  // Which tab is highlighted (-1 = none, e.g. on /activity or /notes).
  let activeIndex = BOTTOM_NAV_ITEMS.findIndex((i) => i.href && isActivePath(pathname, i.href));
  const accountIndex = BOTTOM_NAV_ITEMS.findIndex((i) => i.key === "account");
  if (sheetOpen || ACCOUNT_PATHS.some((p) => isActivePath(pathname, p))) activeIndex = accountIndex;

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

  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const hue = hueFromString(user.id);

  function badgeFor(key) {
    if (key === "chat") return chatUnread;
    if (key === "account") return unread;
    return 0;
  }

  return (
    <>
      <div className={`bnav-backdrop ${sheetOpen ? "is-visible" : ""}`} onClick={() => setSheetOpen(false)} aria-hidden="true" />

      {sheetOpen && (
        <div className="bnav-sheet" role="dialog" aria-modal="true" aria-label="حساب کاربری" tabIndex={-1} ref={sheetRef}>
          <div className="bnav-sheet-head">
            <span className="avatar avatar-lg" style={{ "--h": hue }}>{initials(user.firstName, user.lastName)}</span>
            <div>
              <strong>{fullName}</strong>
              <small dir="ltr">{user.email}</small>
            </div>
            <span className={`chip ${role === "owner" ? "chip-owner" : "chip-member"}`}>{role === "owner" ? "مالک" : "عضو"}</span>
          </div>

          <Link href="/notifications" className="bnav-row">
            <Icon name="bell" size={19} />
            <span>اعلان‌ها</span>
            {unread > 0 && <span className="nav-badge">{faCount(unread)}</span>}
          </Link>
          <Link href="/settings" className="bnav-row">
            <Icon name="settings" size={19} />
            <span>تنظیمات</span>
          </Link>
          <button
            type="button"
            className="bnav-row"
            onClick={() => {
              setSheetOpen(false);
              onOpenMenu?.();
            }}
          >
            <Icon name="menu" size={19} />
            <span>همه بخش‌ها</span>
          </button>
          <PwaControls rowClass="bnav-row" />
          <button type="button" className="bnav-row bnav-row-danger" onClick={logout} disabled={busy}>
            <Icon name="logout" size={19} />
            <span>{busy ? "در حال خروج..." : "خروج از حساب"}</span>
          </button>
        </div>
      )}

      <nav className="bottom-nav" aria-label="ناوبری پایین">
        <div className="bnav-track" style={{ "--i": Math.max(activeIndex, 0), "--n": BOTTOM_NAV_ITEMS.length }} data-active={activeIndex >= 0 ? "true" : "false"}>
          <span className="bnav-indicator" aria-hidden="true" />
          {BOTTOM_NAV_ITEMS.map((item, index) => {
            const active = index === activeIndex;
            const badge = badgeFor(item.key);
            const inner = (
              <>
                <span className="bnav-icon">
                  <Icon name={item.icon} size={23} strokeWidth={active ? 2.1 : 1.8} />
                  {badge > 0 && <span className="bnav-badge">{faCount(badge)}</span>}
                </span>
                <span className="bnav-label">{item.label}</span>
              </>
            );

            if (item.key === "account") {
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`bnav-item ${active ? "is-active" : ""}`}
                  aria-haspopup="dialog"
                  aria-expanded={sheetOpen}
                  onClick={() => setSheetOpen((v) => !v)}
                >
                  {inner}
                </button>
              );
            }
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`bnav-item ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {inner}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
