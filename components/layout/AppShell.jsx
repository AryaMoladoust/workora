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

const SIDEBAR_COOKIE = "workora_sidebar";

function ShellFrame({ pathname, user, workspace, role, theme, mode, font, sidebarCollapsed, children }) {
  const { unread, setUnread, chatUnread } = useRealtime();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(Boolean(sidebarCollapsed));

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      try {
        document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      } catch {
        /* cookies blocked: the state just is not remembered */
      }
      return next;
    });
  }

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

  // The chat page owns the whole screen: only the conversation list and the messages (no sidebar, header or bottom bar).
  if (pathname === "/chat") {
    return (
      <div className="app-shell app-shell-chat">
        <main className="chat-fullscreen">{children}</main>
      </div>
    );
  }

  return (
    <div className={`app-shell${collapsed ? " is-sidebar-collapsed" : ""}`}>
      <Sidebar
        pathname={pathname}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        user={user}
        workspace={workspace}
        role={role}
        unread={unread}
        chatUnread={chatUnread}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
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

export default function AppShell({ user, workspace, role, theme, mode, font, sidebarCollapsed = false, unread = 0, chatUnread = 0, children }) {
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
      <ShellFrame pathname={pathname} user={user} workspace={workspace} role={role} theme={theme} mode={mode} font={font} sidebarCollapsed={sidebarCollapsed}>
        {children}
      </ShellFrame>
    </RealtimeProvider>
  );
}
