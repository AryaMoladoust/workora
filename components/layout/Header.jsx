"use client";

import Icon from "../ui/Icon";
import NotificationBell from "../notifications/NotificationBell";
import ThemeSwitcher from "./ThemeSwitcher";
import UserMenu from "./UserMenu";
import { titleForPath } from "./nav";

export default function Header({ pathname, user, role, workspace, theme, mode, font, unread, setUnread, onMenu }) {
  return (
    <header className="header">
      <div className="header-start">
        <button type="button" className="icon-button header-menu" aria-label="باز کردن منو" onClick={onMenu}>
          <Icon name="menu" size={20} />
        </button>
        <div className="header-title">
          <span>{workspace.name}</span>
          <h2>{titleForPath(pathname)}</h2>
        </div>
      </div>

      <div className="header-end">
        <ThemeSwitcher initialTheme={theme} initialMode={mode} initialFont={font} />
        <NotificationBell unread={unread} setUnread={setUnread} />
        <UserMenu user={user} role={role} />
      </div>
    </header>
  );
}
