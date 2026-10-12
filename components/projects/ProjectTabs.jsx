"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "../ui/Icon";

export default function ProjectTabs({ projectId, canEdit }) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const tabs = [
    { href: base, label: "نمای کلی", icon: "dashboard", exact: true },
    { href: `${base}/tasks`, label: "وظایف", icon: "tasks" },
    { href: `${base}/members`, label: "اعضا", icon: "users" },
    { href: `${base}/chat`, label: "چت", icon: "chat" },
    { href: `${base}/activity`, label: "فعالیت‌ها", icon: "activity" },
    ...(canEdit ? [{ href: `${base}/settings`, label: "تنظیمات", icon: "settings" }] : []),
  ];

  return (
    <nav className="tabs" aria-label="بخش‌های پروژه">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className={`tab ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}>
            <Icon name={tab.icon} size={17} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
