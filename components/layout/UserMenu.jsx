"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "../ui/Icon";
import Avatar from "../ui/Avatar";
import PwaControls from "../pwa/PwaControls";
import { usePwa } from "../pwa/PwaProvider";
import { initials, hueFromString } from "../../lib/format";

export default function UserMenu({ user, role }) {
  const router = useRouter();
  const pwa = usePwa();
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
      await pwa.detachPush();
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
        <Avatar user={user} />
        <span className="user-button-text">
          <strong>{fullName}</strong>
          <small>{role === "owner" ? "مالک" : "عضو"}</small>
        </span>
        <Icon name="chevronDown" size={16} className="user-button-chevron" />
      </button>

      {open && (
        <div className="popover user-popover" role="menu">
          <div className="user-popover-head">
            <Avatar user={user} size="lg" />
            <div>
              <strong>{fullName}</strong>
              <small dir="ltr">{user.email}</small>
            </div>
          </div>
          <Link href="/profile" role="menuitem" className="menu-item" onClick={() => setOpen(false)}>
            <Icon name="user" size={18} />
            پروفایل من
          </Link>
          <div className="pwa-menu" role="group" aria-label="برنامه و اعلان‌ها">
            <PwaControls rowClass="menu-item" />
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
