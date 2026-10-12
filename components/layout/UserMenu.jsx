"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "../ui/Icon";
import { initials, hueFromString } from "../../lib/format";

export default function UserMenu({ user, role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  const fullName = `${user.firstName} ${user.lastName}`.trim();
  const hue = hueFromString(user.id);

  return (
    <div className="popover-root" ref={rootRef}>
      <button
        type="button"
        className="user-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="avatar" style={{ "--h": hue }}>{initials(user.firstName, user.lastName)}</span>
        <span className="user-button-text">
          <strong>{fullName}</strong>
          <small>{role === "owner" ? "مالک" : "عضو"}</small>
        </span>
        <Icon name="chevronDown" size={16} className="user-button-chevron" />
      </button>

      {open && (
        <div className="popover user-popover" role="menu">
          <div className="user-popover-head">
            <span className="avatar avatar-lg" style={{ "--h": hue }}>{initials(user.firstName, user.lastName)}</span>
            <div>
              <strong>{fullName}</strong>
              <small dir="ltr">{user.email}</small>
            </div>
          </div>
          <button type="button" role="menuitem" className="menu-item menu-item-danger" onClick={logout} disabled={busy}>
            <Icon name="logout" size={18} />
            {busy ? "در حال خروج..." : "خروج از حساب"}
          </button>
        </div>
      )}
    </div>
  );
}
