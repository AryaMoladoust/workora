// Rules for the "extra" parts of a task: checklist, labels, repeating tasks, dependencies and deadline reminders.
// Pure functions (no database), so they are easy to test and safe to use from any route.
import { randomBytes } from "node:crypto";
import { daysUntil } from "./format";
import { jalaliMonthLength, jalaliToGregorianKey, parseGregorianKey } from "./jalali";
import { BLOCKERS_MAX, CHECKLIST_MAX, LABELS_MAX, LABEL_COLORS, RECURRENCE_EVERY } from "./task-constants";

export { BLOCKERS_MAX, CHECKLIST_MAX, LABELS_MAX, LABEL_COLORS, RECURRENCE_EVERY };

/* ------------------------------------------------------------------ checklist */
export function sanitizeChecklist(input) {
  const out = [];
  for (const raw of Array.isArray(input) ? input : []) {
    const text = String(raw?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!text) continue;
    out.push({ text, done: Boolean(raw.done) });
    if (out.length >= CHECKLIST_MAX) break;
  }
  return out;
}

export function checklistProgress(list) {
  const items = Array.isArray(list) ? list : [];
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

/* ------------------------------------------------------------------ labels (defined per project) */

// Keeps the ids of labels that already exist (so tasks stay tagged), gives new labels an id, drops duplicates.
export function sanitizeLabels(input, existing = []) {
  const known = new Set((existing || []).map((l) => String(l.id)));
  const seenNames = new Set();
  const seenIds = new Set();
  const out = [];
  for (const raw of Array.isArray(input) ? input : []) {
    const name = String(raw?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 30);
    if (!name || seenNames.has(name.toLowerCase())) continue;
    seenNames.add(name.toLowerCase());
    let id = String(raw.id || "");
    if (!known.has(id) || seenIds.has(id)) id = randomBytes(5).toString("hex");
    seenIds.add(id);
    out.push({ id, name, color: LABEL_COLORS.includes(raw.color) ? raw.color : LABEL_COLORS[5] });
    if (out.length >= LABELS_MAX) break;
  }
  return out;
}

// Only ids of labels that exist in the project.
export function sanitizeLabelIds(input, projectLabels = []) {
  const valid = new Set((projectLabels || []).map((l) => String(l.id)));
  return [...new Set((Array.isArray(input) ? input : []).map(String))].filter((id) => valid.has(id)).slice(0, LABELS_MAX);
}

/* ------------------------------------------------------------------ repeating tasks */
// → { every, interval } or null (= does not repeat)
export function sanitizeRecurrence(input) {
  if (!input || !RECURRENCE_EVERY.includes(input.every)) return null;
  const interval = Number.parseInt(input.interval, 10);
  return { every: input.every, interval: Number.isFinite(interval) ? Math.min(30, Math.max(1, interval)) : 1 };
}

const DAY = 86400000;
const keyMs = (key) => Date.parse(`${key}T00:00:00Z`);
const msKey = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDaysKey = (key, n) => msKey(keyMs(key) + n * DAY);

// Months are Jalali months (what the users think in); the day of the month is kept (clamped for short months).
export function addJalaliMonthsKey(key, n) {
  const { jy, jm, jd } = parseGregorianKey(key);
  const total = jy * 12 + (jm - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return jalaliToGregorianKey(ny, nm, Math.min(jd, jalaliMonthLength(ny, nm)));
}

function stepKey(anchorKey, rule, i) {
  if (rule.every === "daily") return addDaysKey(anchorKey, rule.interval * i);
  if (rule.every === "weekly") return addDaysKey(anchorKey, 7 * rule.interval * i);
  return addJalaliMonthsKey(anchorKey, rule.interval * i);
}

/**
 * Dates of the next occurrence of a repeating task (all values are "YYYY-MM-DD" day keys).
 * The next due date is the first one in the series that is AFTER today, so a task finished very late does not
 * create a pile of already-overdue copies. The start date keeps its distance to the due date.
 */
export function nextOccurrence({ dueKey, startKey = null, todayKey, rule }) {
  let i = 1;
  let next = stepKey(dueKey, rule, i);
  while (next <= todayKey && i < 5000) {
    i += 1;
    next = stepKey(dueKey, rule, i);
  }
  const shift = Math.round((keyMs(next) - keyMs(dueKey)) / DAY);
  return { dueKey: next, startKey: startKey ? addDaysKey(startKey, shift) : null };
}

/* ------------------------------------------------------------------ dependencies */
// edges: Map(taskId → [ids of tasks it waits for]). Would "taskId waits for newBlockers" create a loop?
export function wouldCycle(taskId, newBlockers, edges) {
  const target = String(taskId);
  const seen = new Set();
  const stack = (newBlockers || []).map(String);
  while (stack.length) {
    const id = stack.pop();
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of edges.get(id) || []) stack.push(String(next));
  }
  return false;
}

// byId: Map(id → { title, status }). The blockers of a task that are not finished yet.
export function openBlockers(task, byId) {
  return (task.blockedBy || []).map(String).map((id) => ({ id, ...(byId.get(id) || { title: "وظیفه‌ی حذف‌شده", status: "done" }) })).filter((b) => b.status !== "done");
}

/* ------------------------------------------------------------------ deadline reminders (daily cron) */
// → { kind: "due_soon" | "overdue", days } or null. Every reminder is sent once per due date.
export function reminderFor(task, now = new Date()) {
  if (!task.dueAt || task.status === "done" || !task.assigneeId) return null;
  const days = daysUntil(task.dueAt, now);
  if (days < 0) return days >= -3 && !task.reminders?.overdueAt ? { kind: "overdue", days } : null;
  if (days <= 1) return task.reminders?.dueSoonAt ? null : { kind: "due_soon", days };
  return null;
}
