export const NAV_GROUPS = [
  {
    label: "اصلی",
    items: [
      { href: "/dashboard", label: "داشبورد", icon: "dashboard" },
      { href: "/projects", label: "پروژه‌ها", icon: "folder" },
      { href: "/tasks", label: "وظایف من", icon: "tasks" },
      { href: "/chat", label: "چت", icon: "chat" },
    ],
  },
  {
    label: "پیگیری",
    items: [
      { href: "/activity", label: "فعالیت‌ها", icon: "activity" },
      { href: "/notifications", label: "اعلان‌ها", icon: "bell" },
    ],
  },
  {
    label: "همکاری",
    items: [
      { href: "/announcements", label: "اطلاعیه‌ها", icon: "megaphone" },
      { href: "/notes", label: "یادداشت‌ها", icon: "note" },
      { href: "/members", label: "اعضا", icon: "users" },
    ],
  },
  {
    label: "سیستم",
    items: [
      { href: "/configs", label: "کانفیگ‌ها", icon: "code" },
      { href: "/settings", label: "تنظیمات", icon: "settings" },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function isActivePath(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function titleForPath(pathname) {
  const item = ALL_NAV_ITEMS.find((i) => isActivePath(pathname, i.href));
  return item ? item.label : "Workora";
}

// Bottom navigation (phones / tablets). The 5th tab ("حساب کاربری") opens an account sheet.
export const BOTTOM_NAV_ITEMS = [
  { key: "dashboard", href: "/dashboard", label: "داشبورد", icon: "dashboard" },
  { key: "projects", href: "/projects", label: "پروژه‌ها", icon: "folder" },
  { key: "tasks", href: "/tasks", label: "وظایف", icon: "tasks" },
  { key: "chat", href: "/chat", label: "چت", icon: "chat" },
  { key: "account", href: null, label: "حساب من", icon: "user" },
];

// Pages that belong to the "account" tab even though they are not a tab of their own.
export const ACCOUNT_PATHS = ["/settings", "/notifications"];
