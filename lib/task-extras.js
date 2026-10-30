import mongoose from "mongoose";
import { dayKey } from "./format";
import { parseOptionalDate } from "./validation";
import { BLOCKERS_MAX, nextOccurrence, sanitizeChecklist, sanitizeLabelIds, sanitizeRecurrence, wouldCycle } from "./task-logic";
import Task from "../database/models/Task";

// Reads checklist / labelIds / recurrence / blockedBy from a request body (only the keys that are present)
// and validates them. → { error, status } or { set }.
export async function parseTaskExtras(body, { project, workspaceId, taskId = null }) {
  const set = {};
  if (body.checklist !== undefined) set.checklist = sanitizeChecklist(body.checklist);
  if (body.labelIds !== undefined) set.labelIds = sanitizeLabelIds(body.labelIds, project.labels);
  if (body.recurrence !== undefined) set.recurrence = sanitizeRecurrence(body.recurrence); // null = does not repeat

  if (body.blockedBy !== undefined) {
    const ids = [...new Set((Array.isArray(body.blockedBy) ? body.blockedBy : []).map(String))];
    if (ids.length > BLOCKERS_MAX) return { error: `هر وظیفه حداکثر ${BLOCKERS_MAX} پیش‌نیاز می‌تواند داشته باشد.`, status: 400 };
    if (ids.some((id) => !mongoose.isValidObjectId(id))) return { error: "پیش‌نیاز نامعتبر است.", status: 400 };
    if (taskId && ids.includes(String(taskId))) return { error: "یک وظیفه نمی‌تواند منتظر خودش باشد.", status: 400 };

    if (ids.length) {
      const found = await Task.countDocuments({ _id: { $in: ids }, projectId: project._id, workspaceId });
      if (found !== ids.length) return { error: "پیش‌نیازها باید وظیفه‌هایی از همین پروژه باشند.", status: 400 };
      if (taskId) {
        const linked = await Task.find({ projectId: project._id, workspaceId, "blockedBy.0": { $exists: true } }).select("blockedBy").lean();
        const edges = new Map(linked.map((t) => [String(t._id), t.blockedBy.map(String)]));
        if (wouldCycle(taskId, ids, edges)) return { error: "این پیش‌نیاز یک حلقه می‌سازد (وظیفه‌ای که خودش منتظر این وظیفه است).", status: 400 };
      }
    }
    set.blockedBy = ids;
  }
  return { set };
}

// A task cannot be started or finished while one of the tasks it waits for is still open.
export async function blockerError(blockerIds, workspaceId) {
  const ids = (blockerIds || []).map(String);
  if (!ids.length) return null;
  const rows = await Task.find({ _id: { $in: ids }, workspaceId, status: { $ne: "done" } }).select("title").lean();
  if (!rows.length) return null;
  const names = rows.slice(0, 3).map((r) => `«${r.title}»`).join("، ");
  return `این وظیفه منتظر ${names}${rows.length > 3 ? " و موارد دیگر" : ""} است؛ اول آن را انجام دهید.`;
}

// When a repeating task is finished, create the next one. Claims the task first (atomic), so finishing it twice
// (done → todo → done) or two people finishing it at the same moment can never create two copies.
// Returns the new task document or null.
export async function spawnNextOccurrence(task, now = new Date()) {
  if (!task.recurrence?.every || !task.dueAt) return null;
  const claimed = await Task.findOneAndUpdate({ _id: task._id, recurrenceSpawned: { $ne: true } }, { $set: { recurrenceSpawned: true } }, { new: true }).lean();
  if (!claimed) return null;

  const next = nextOccurrence({
    dueKey: dayKey(task.dueAt),
    startKey: task.startAt ? dayKey(task.startAt) : null,
    todayKey: dayKey(now),
    rule: { every: task.recurrence.every, interval: task.recurrence.interval || 1 },
  });
  const due = parseOptionalDate(next.dueKey);
  const start = next.startKey ? parseOptionalDate(next.startKey) : { ok: true, value: null };
  if (!due.ok || !start.ok) return null;

  return Task.create({
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    title: task.title,
    description: task.description || "",
    status: "todo",
    priority: task.priority,
    assigneeId: task.assigneeId || null,
    createdBy: task.createdBy,
    startAt: start.value,
    dueAt: due.value,
    completedAt: null,
    checklist: (task.checklist || []).map((i) => ({ text: i.text, done: false })), // every copy starts unticked
    labelIds: task.labelIds,
    recurrence: task.recurrence,
    seriesId: task.seriesId || task._id,
  });
}
