import mongoose from "mongoose";
import { hasPermission } from "./permissions";
import { daysUntil, dueInfo, toDateInput, dateTime } from "./format";
import Comment from "../database/models/Comment";

export function isTaskManager(current) {
  return hasPermission(current, "projects.manage") || hasPermission(current, "tasks.manage");
}

export function serializeTask(task, { projectName, commentCount, now = new Date() } = {}) {
  const done = task.status === "done";
  const info = task.dueAt ? dueInfo(task.dueAt, now) : { text: "", tone: "none" };
  const out = {
    id: String(task._id),
    projectId: String(task.projectId),
    title: task.title,
    description: task.description || "",
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId ? String(task.assigneeId) : null,
    createdBy: String(task.createdBy),
    createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : null,
    startInput: toDateInput(task.startAt),
    dueInput: toDateInput(task.dueAt),
    dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : null,
    dueText: task.dueAt ? info.text : "",
    dueTone: task.dueAt && !done ? info.tone : "none",
    dueDiff: task.dueAt ? daysUntil(task.dueAt, now) : null,
  };
  if (projectName !== undefined) out.projectName = projectName;
  if (commentCount !== undefined) out.commentCount = commentCount;
  return out;
}

export async function commentCountsFor(taskIds) {
  if (!taskIds.length) return new Map();
  const rows = await Comment.aggregate([
    { $match: { taskId: { $in: taskIds.map((id) => new mongoose.Types.ObjectId(String(id))) } } },
    { $group: { _id: "$taskId", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export function serializeComment(comment, author, now = new Date()) {
  return {
    id: String(comment._id),
    taskId: String(comment.taskId),
    authorId: String(comment.authorId),
    authorName: author ? `${author.firstName} ${author.lastName}` : "کاربر حذف‌شده",
    body: comment.body,
    createdText: dateTime(comment.createdAt, now),
  };
}

// Returns an error message when the assignee is not allowed, otherwise null.
export function assigneeError(project, assigneeId) {
  if (!assigneeId) return null;
  if (!mongoose.isValidObjectId(assigneeId)) return "مسئول وظیفه نامعتبر است.";
  const isMember = (project.memberIds || []).map(String).includes(String(assigneeId));
  return isMember ? null : "مسئول وظیفه باید عضو پروژه باشد.";
}
