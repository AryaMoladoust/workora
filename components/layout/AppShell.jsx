"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Header from "./Header";
import ThemeSwitcher from "./ThemeSwitcher";
import BottomNav from "./BottomNav";
import RealtimeProvider, { useRealtime } from "../realtime/RealtimeProvider";

const AUTH_PATHS = ["/login", "/register", "/owner-login"];

function isAuthPath(pathname) {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function ShellFrame({ pathname, user, workspace, role, theme, mode, font, children }) {
  const { unread, setUnread, chatUnread } = useRealtime();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <Sidebar
        pathname={pathname}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        workspace={workspace}
        role={role}
        unread={unread}
        chatUnread={chatUnread}
      />
      <div className={`sidebar-overlay ${menuOpen ? "is-visible" : ""}`} onClick={() => setMenuOpen(false)} aria-hidden="true" />
      <div className="app-main">
        <Header
          pathname={pathname}
          user={user}
          role={role}
          workspace={workspace}
          theme={theme}
          mode={mode}
          font={font}
          unread={unread}
          setUnread={setUnread}
          onMenu={() => setMenuOpen(true)}
        />
        <main className={`app-content ${pathname === "/chat" ? "app-content-wide" : ""}`}>{children}</main>
      </div>
      <BottomNav
        pathname={pathname}
        user={user}
        role={role}
        unread={unread}
        chatUnread={chatUnread}
        onOpenMenu={() => setMenuOpen(true)}
      />
    </div>
  );
}

export default function AppShell({ user, workspace, role, theme, mode, font, unread = 0, chatUnread = 0, children }) {
  const pathname = usePathname();

  // Login / register pages: no shell, only a floating theme switcher.
  if (isAuthPath(pathname)) {
    return (
      <>
        <div className="auth-tools">
          <ThemeSwitcher initialTheme={theme} initialMode={mode} initialFont={font} />
        </div>
        {children}
      </>
    );
  }

  // Not signed in: the page itself redirects to /login.
  if (!user || !workspace) return <>{children}</>;

  return (
    <RealtimeProvider userId={user.id} initialUnread={unread} initialChatUnread={chatUnread}>
      <ShellFrame pathname={pathname} user={user} workspace={workspace} role={role} theme={theme} mode={mode} font={font}>
        {children}
      </ShellFrame>
    </RealtimeProvider>
  );
}
