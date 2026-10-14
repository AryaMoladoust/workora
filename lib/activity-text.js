// Pure helpers (server + client safe): turn stored activity / notification records into Persian text.
import { PROJECT_STATUS_LABELS, STATUS_LABELS } from "./format";

export const TYPE_GROUPS = {
  task: ["task.created", "task.status_changed", "task.assigned", "task.updated", "task.deleted"],
  comment: ["comment.created"],
  project: ["project.created", "project.updated", "project.status_changed", "project.members_changed", "project.deleted"],
  member: ["member.created", "member.joined", "member.permissions_changed", "member.activated", "member.deactivated", "member.signup_request", "member.approved", "member.rejected"],
};

export const GROUP_LABELS = { task: "وظایف", comment: "کامنت‌ها", project: "پروژه‌ها", member: "اعضا" };

export const FIELD_LABELS = {
  title: "عنوان",
  description: "توضیحات",
  priority: "اولویت",
  startAt: "تاریخ شروع",
  dueAt: "مهلت",
  name: "نام",
};

const fa = (n) => Number(n).toLocaleString("fa-IR");
const quote = (s) => (s ? `«${s}»` : "");
const fields = (meta) => (meta?.fields || []).map((f) => FIELD_LABELS[f] || f).join("، ");

// Returns { prefix, title, suffix, icon, tone } – full sentence: actor + prefix + title + suffix
export function describeActivity(a) {
  const m = a.meta || {};
  const title = quote(a.entityTitle);
  switch (a.type) {
    case "task.created":
      return { prefix: "وظیفه ", title, suffix: m.assigneeName ? ` را ساخت و به ${m.assigneeName} سپرد` : " را ساخت", icon: "plus", tone: "ok" };
    case "task.status_changed":
      return {
        prefix: "وضعیت وظیفه ",
        title,
        suffix: m.to === "done" ? " را «انجام شده» کرد" : ` را از «${STATUS_LABELS[m.from] || m.from}» به «${STATUS_LABELS[m.to] || m.to}» تغییر داد`,
        icon: m.to === "done" ? "check" : "trend",
        tone: m.to === "done" ? "ok" : "info",
      };
    case "task.assigned":
      return { prefix: "وظیفه ", title, suffix: m.toName ? ` را به ${m.toName} سپرد` : " را بدون مسئول کرد", icon: "users", tone: "accent" };
    case "task.updated":
      return { prefix: "وظیفه ", title, suffix: ` را ویرایش کرد${fields(m) ? ` (${fields(m)})` : ""}`, icon: "note", tone: "muted" };
    case "task.deleted":
      return { prefix: "وظیفه ", title, suffix: " را حذف کرد", icon: "close", tone: "danger" };
    case "comment.created":
      return { prefix: "روی وظیفه ", title, suffix: " کامنت گذاشت", icon: "chat", tone: "accent" };
    case "project.created":
      return { prefix: "پروژه ", title, suffix: " را ساخت", icon: "folder", tone: "ok" };
    case "project.updated":
      return { prefix: "پروژه ", title, suffix: ` را ویرایش کرد${fields(m) ? ` (${fields(m)})` : ""}`, icon: "folder", tone: "muted" };
    case "project.status_changed":
      return { prefix: "وضعیت پروژه ", title, suffix: ` را به «${PROJECT_STATUS_LABELS[m.to] || m.to}» تغییر داد`, icon: "folder", tone: "info" };
    case "project.members_changed": {
      const parts = [];
      if (m.added?.length) parts.push(`افزودن ${m.added.join("، ")}`);
      if (m.removed?.length) parts.push(`حذف ${m.removed.join("، ")}`);
      return { prefix: "اعضای پروژه ", title, suffix: ` را تغییر داد${parts.length ? ` (${parts.join(" · ")})` : ""}`, icon: "users", tone: "accent" };
    }
    case "project.deleted":
      return { prefix: "پروژه ", title, suffix: " را حذف کرد", icon: "close", tone: "danger" };
    case "member.created":
      return { prefix: "عضو جدید ", title, suffix: " را به فضای کاری اضافه کرد", icon: "users", tone: "ok" };
    case "member.joined":
      return { prefix: "", title, suffix: " با کد دعوت به فضای کاری پیوست", icon: "users", tone: "ok" };
    case "member.signup_request":
      return { prefix: "درخواست ثبت‌نام ", title: m.email ? `«${m.email}»` : title, suffix: " ثبت کرد", icon: "users", tone: "info" };
    case "member.approved":
      return { prefix: "درخواست ثبت‌نام ", title, suffix: " را تایید کرد", icon: "check", tone: "ok" };
    case "member.rejected":
      return { prefix: "درخواست ثبت‌نام ", title, suffix: " را رد کرد", icon: "close", tone: "danger" };
    case "member.permissions_changed":
      return { prefix: "دسترسی‌های ", title, suffix: " را تغییر داد", icon: "settings", tone: "accent" };
    case "member.activated":
      return { prefix: "حساب ", title, suffix: " را فعال کرد", icon: "check", tone: "ok" };
    case "member.deactivated":
      return { prefix: "حساب ", title, suffix: " را غیرفعال کرد", icon: "close", tone: "danger" };
    default:
      return { prefix: "", title, suffix: " (فعالیت)", icon: "activity", tone: "muted" };
  }
}

// Text for the person who receives a notification (the actor is a separate field).
export function describeNotification(n) {
  const title = quote(n.entityTitle);
  const m = n.meta || {};
  switch (n.type) {
    case "task.assigned":
      return { prefix: "وظیفه ", title, suffix: " را به شما سپرد", icon: "tasks" };
    case "task.status_changed":
      return { prefix: "وضعیت وظیفه ", title, suffix: ` را به «${STATUS_LABELS[m.to] || m.to}» تغییر داد`, icon: m.to === "done" ? "check" : "trend" };
    case "comment.created":
      return { prefix: "روی وظیفه ", title, suffix: " کامنت گذاشت", icon: "chat" };
    case "announcement.created":
      return { prefix: "اطلاعیه جدید: ", title, suffix: "", icon: "megaphone" };
    case "member.signup_request":
      return { prefix: "درخواست ثبت‌نام ", title: m.email ? `«${m.email}»` : title, suffix: " ثبت کرد", icon: "users" };
    case "project.member_added":
      return { prefix: "شما را به پروژه ", title, suffix: " اضافه کرد", icon: "folder" };
    default:
      return { prefix: "", title, suffix: "", icon: "bell" };
  }
}

export function linkFor(item) {
  if (item.entityType === "announcement") return "/announcements";
  if (item.entityType === "member") return "/members";
  if (!item.projectId) return null;
  if (item.entityType === "task" || item.entityType === "comment") {
    if (item.type === "task.deleted") return `/projects/${item.projectId}`;
    return item.entityId ? `/projects/${item.projectId}/tasks?task=${item.entityId}` : `/projects/${item.projectId}/tasks`;
  }
  if (item.entityType === "project") return item.type === "project.deleted" ? null : `/projects/${item.projectId}`;
  return null;
}
