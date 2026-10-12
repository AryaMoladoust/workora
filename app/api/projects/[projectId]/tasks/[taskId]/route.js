import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../lib/auth";
import { findAccessibleProject } from "../../../../../../lib/project-access";
import { assigneeError, isTaskManager, serializeTask } from "../../../../../../lib/tasks";
import { logActivity, notify, userNameMap } from "../../../../../../lib/activity";
import { canDeleteTask, canEditTask } from "../../../../../../lib/task-rules";
import { parseOptionalDate } from "../../../../../../lib/validation";
import Task, { TASK_PRIORITIES, TASK_STATUSES } from "../../../../../../database/models/Task";
import Comment from "../../../../../../database/models/Comment";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function PATCH(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  if (!mongoose.isValidObjectId(params.projectId) || !mongoose.isValidObjectId(params.taskId)) return bad("شناسه نامعتبر است.");

  try {
    const project = await findAccessibleProject(current, params.projectId);
    if (!project) return bad("پروژه پیدا نشد.", 404);

    await connectToDatabase();
    const existing = await Task.findOne({ _id: params.taskId, projectId: project._id, workspaceId: current.workspace.id }).lean();
    if (!existing) return bad("وظیفه پیدا نشد.", 404);

    const rules = { isManager: isTaskManager(current), userId: current.user.id };
    if (!canEditTask(rules, existing)) return bad("اجازه ویرایش این وظیفه را ندارید.", 403);

    const body = await request.json();
    const update = {};

    if (body.title !== undefined) {
      update.title = String(body.title).trim();
      if (update.title.length < 2 || update.title.length > 240) return bad("عنوان وظیفه باید بین ۲ تا ۲۴۰ کاراکتر باشد.");
    }
    if (body.description !== undefined) {
      update.description = String(body.description).trim();
      if (update.description.length > 10000) return bad("توضیحات بیش از حد طولانی است.");
    }
    if (body.status !== undefined) {
      if (!TASK_STATUSES.includes(body.status)) return bad("وضعیت نامعتبر است.");
      update.status = body.status;
      if (body.status === "done" && existing.status !== "done") update.completedAt = new Date();
      if (body.status !== "done") update.completedAt = null;
    }
    if (body.priority !== undefined) {
      if (!TASK_PRIORITIES.includes(body.priority)) return bad("اولویت نامعتبر است.");
      update.priority = body.priority;
    }
    if (body.assigneeId !== undefined) {
      const assigneeId = body.assigneeId || null;
      // only validate when the assignee actually changes (an old assignee may have left the project)
      if (String(assigneeId || "") !== String(existing.assigneeId || "")) {
        const problem = assigneeError(project, assigneeId);
        if (problem) return bad(problem);
      }
      update.assigneeId = assigneeId;
    }

    const start = body.startAt !== undefined ? parseOptionalDate(body.startAt) : null;
    const due = body.dueAt !== undefined ? parseOptionalDate(body.dueAt) : null;
    if ((start && !start.ok) || (due && !due.ok)) return bad("تاریخ واردشده معتبر نیست.");
    if (start) update.startAt = start.value;
    if (due) update.dueAt = due.value;
    const finalStart = start ? start.value : existing.startAt;
    const finalDue = due ? due.value : existing.dueAt;
    if (finalStart && finalDue && new Date(finalDue) < new Date(finalStart)) {
      return bad("مهلت نمی‌تواند قبل از تاریخ شروع باشد.");
    }

    const task = await Task.findOneAndUpdate(
      { _id: params.taskId, projectId: project._id, workspaceId: current.workspace.id },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();
    if (!task) return bad("وظیفه پیدا نشد.", 404);

    // ---- activity log + notifications
    const sameDate = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
    const base = { entityType: "task", entityId: task._id, entityTitle: task.title, project };

    if (update.status !== undefined && update.status !== existing.status) {
      await logActivity(current, { ...base, type: "task.status_changed", meta: { from: existing.status, to: update.status } });
      await notify(current, [existing.createdBy, task.assigneeId], { ...base, type: "task.status_changed", meta: { to: update.status } });
    }

    if (update.assigneeId !== undefined && String(update.assigneeId || "") !== String(existing.assigneeId || "")) {
      const names = update.assigneeId ? await userNameMap([update.assigneeId]) : new Map();
      await logActivity(current, { ...base, type: "task.assigned", meta: { toName: names.get(String(update.assigneeId)) || "" } });
      if (update.assigneeId) await notify(current, [update.assigneeId], { ...base, type: "task.assigned" });
    }

    const changedFields = [];
    if (update.title !== undefined && update.title !== existing.title) changedFields.push("title");
    if (update.description !== undefined && update.description !== (existing.description || "")) changedFields.push("description");
    if (update.priority !== undefined && update.priority !== existing.priority) changedFields.push("priority");
    if (update.startAt !== undefined && !sameDate(update.startAt, existing.startAt)) changedFields.push("startAt");
    if (update.dueAt !== undefined && !sameDate(update.dueAt, existing.dueAt)) changedFields.push("dueAt");
    if (changedFields.length) await logActivity(current, { ...base, type: "task.updated", meta: { fields: changedFields } });

    return NextResponse.json({ task: serializeTask(task, { projectName: project.name }) });
  } catch (error) {
    console.error("TASK_UPDATE_ERROR", error);
    return bad("ویرایش وظیفه انجام نشد.", 500);
  }
}

export async function DELETE(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  if (!mongoose.isValidObjectId(params.projectId) || !mongoose.isValidObjectId(params.taskId)) return bad("شناسه نامعتبر است.");

  const project = await findAccessibleProject(current, params.projectId);
  if (!project) return bad("پروژه پیدا نشد.", 404);

  await connectToDatabase();
  const existing = await Task.findOne({ _id: params.taskId, projectId: project._id, workspaceId: current.workspace.id }).lean();
  if (!existing) return bad("وظیفه پیدا نشد.", 404);

  if (!canDeleteTask({ isManager: isTaskManager(current), userId: current.user.id }, existing)) {
    return bad("اجازه حذف این وظیفه را ندارید.", 403);
  }

  await Task.deleteOne({ _id: existing._id });
  await Comment.deleteMany({ taskId: existing._id });
  await logActivity(current, { type: "task.deleted", entityType: "task", entityId: existing._id, entityTitle: existing.title, project });
  return NextResponse.json({ ok: true });
}
