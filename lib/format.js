// Persian-friendly formatting helpers (server side).
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || process.env.APP_TIMEZONE || "Asia/Tehran";

export const STATUS_LABELS = {
  todo: "انجام نشده",
  in_progress: "در حال انجام",
  done: "انجام شده",
};

export const PRIORITY_LABELS = {
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
  urgent: "فوری",
};

export const PROJECT_STATUS_LABELS = {
  active: "فعال",
  completed: "تکمیل‌شده",
  archived: "بایگانی",
};

const numberFormat = new Intl.NumberFormat("fa-IR");

export function fa(value) {
  return numberFormat.format(Number.isFinite(value) ? value : 0);
}

export function dayKey(date, timeZone = APP_TIMEZONE) {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(date));
}

export function hourOf(date = new Date(), timeZone = APP_TIMEZONE) {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hour12: false }).format(new Date(date));
  return Number.parseInt(h, 10) % 24;
}

export function greeting(date = new Date()) {
  const h = hourOf(date);
  if (h < 5) return "شب بخیر";
  if (h < 12) return "صبح بخیر";
  if (h < 17) return "ظهر بخیر";
  if (h < 20) return "عصر بخیر";
  return "شب بخیر";
}

export function longDate(date = new Date()) {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function shortDate(date) {
  return new Intl.DateTimeFormat("fa-IR", { timeZone: APP_TIMEZONE, month: "long", day: "numeric" }).format(new Date(date));
}

export function weekdayShort(key) {
  // key is YYYY-MM-DD; noon UTC avoids day shifts.
  return new Intl.DateTimeFormat("fa-IR", { timeZone: "UTC", weekday: "short" }).format(new Date(`${key}T12:00:00Z`));
}

function dayDiff(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86400000);
}

// Whole days from today until dueAt (negative = overdue, null = no date), in the app time zone.
export function daysUntil(dueAt, now = new Date()) {
  if (!dueAt) return null;
  return dayDiff(dayKey(now), dayKey(dueAt));
}

// Returns { text, tone } where tone is one of: overdue | soon | normal | none
export function dueInfo(dueAt, now = new Date()) {
  if (!dueAt) return { text: "بدون مهلت", tone: "none" };
  const diff = daysUntil(dueAt, now);
  if (diff < 0) return { text: `${fa(Math.abs(diff))} روز تأخیر`, tone: "overdue" };
  if (diff === 0) return { text: "امروز", tone: "soon" };
  if (diff === 1) return { text: "فردا", tone: "soon" };
  if (diff <= 3) return { text: `${fa(diff)} روز دیگر`, tone: "soon" };
  return { text: shortDate(dueAt), tone: "normal" };
}

export function initials(firstName = "", lastName = "") {
  const a = String(firstName).trim().charAt(0);
  const b = String(lastName).trim().charAt(0);
  return `${a}${b ? "\u200c" + b : ""}` || "؟";
}

export function hueFromString(value = "") {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) % 360;
  return hash;
}

export function dateTime(date, _now) {
  return new Intl.DateTimeFormat("fa-IR", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function fullDate(date) {
  return new Intl.DateTimeFormat("fa-IR", { timeZone: APP_TIMEZONE, year: "numeric", month: "long", day: "numeric" }).format(new Date(date));
}

// YYYY-MM-DD for <input type="date"> (empty string when there is no date)
export function toDateInput(date) {
  return date ? dayKey(date) : "";
}

export function relativeTime(date, now = new Date()) {
  const diffSec = Math.round((new Date(date).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 45) return "همین الان";
  const rtf = new Intl.RelativeTimeFormat("fa", { numeric: "auto" });
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diffSec / 86400), "day");
  return fullDate(date);
}

export function timeOnly(date) {
  return new Intl.DateTimeFormat("fa-IR", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(date));
}

// "امروز" / "دیروز" / long Persian date for a YYYY-MM-DD key.
export function dayLabel(key, now = new Date()) {
  const diff = dayDiff(dayKey(now), key);
  if (diff === 0) return "امروز";
  if (diff === -1) return "دیروز";
  return new Intl.DateTimeFormat("fa-IR", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }).format(new Date(`${key}T12:00:00Z`));
}
