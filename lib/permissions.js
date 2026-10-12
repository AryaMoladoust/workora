// Permission catalog (ids already used by the register route when creating the owner).
export const PERMISSIONS = [
  { id: "projects.manage", label: "مدیریت پروژه‌ها", description: "ساخت، ویرایش و حذف پروژه‌ها و مشاهده همه پروژه‌ها" },
  { id: "tasks.manage", label: "مدیریت وظایف", description: "مدیریت وظایف همه پروژه‌ها (در مرحله وظایف کامل‌تر می‌شود)" },
  { id: "members.manage", label: "مدیریت اعضا", description: "افزودن عضو جدید، ویرایش و تعیین دسترسی‌ها" },
  { id: "settings.manage", label: "مدیریت تنظیمات", description: "تغییر تنظیمات و کانفیگ‌های فضای کاری" },
  { id: "workspace.manage", label: "مدیریت فضای کاری", description: "تنظیمات کلی Workspace" },
];

export const PERMISSION_IDS = PERMISSIONS.map((p) => p.id);

export function isOwner(current) {
  return current?.membership?.role === "owner";
}

export function hasPermission(current, permission) {
  if (!current?.membership) return false;
  if (current.membership.role === "owner") return true;
  return Array.isArray(current.membership.permissions)
    && current.membership.permissions.includes(permission);
}

export function requirePermission(current, permission) {
  if (!hasPermission(current, permission)) {
    const error = new Error("FORBIDDEN");
    error.code = "FORBIDDEN";
    throw error;
  }
}

// Keep only known permission ids (deduplicated).
export function sanitizePermissions(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map(String))].filter((id) => PERMISSION_IDS.includes(id));
}
