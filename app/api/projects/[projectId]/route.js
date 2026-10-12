import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { hasPermission } from "../../../../lib/permissions";
import { findAccessibleProject } from "../../../../lib/project-access";
import { filterActiveMemberIds } from "../../../../lib/members";
import { parseOptionalDate } from "../../../../lib/validation";
import Project, { PROJECT_STATUSES } from "../../../../database/models/Project";
import Task from "../../../../database/models/Task";
import { serializeProject } from "../../../../lib/projects";
import { logActivity, notify, userNameMap } from "../../../../lib/activity";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const project = await findAccessibleProject(current, params.projectId);
  if (!project) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });

  return NextResponse.json({ project: serializeProject(project) });
}

export async function PATCH(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  if (!hasPermission(current, "projects.manage")) {
    return NextResponse.json({ error: "اجازه ویرایش پروژه ندارید." }, { status: 403 });
  }

  try {
    const existing = await findAccessibleProject(current, params.projectId);
    if (!existing) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });

    const body = await request.json();
    const update = {};

    if (body.name !== undefined) {
      update.name = String(body.name).trim();
      if (update.name.length < 2 || update.name.length > 160) {
        return NextResponse.json({ error: "نام پروژه باید بین ۲ تا ۱۶۰ کاراکتر باشد." }, { status: 400 });
      }
    }
    if (body.description !== undefined) {
      update.description = String(body.description).trim();
      if (update.description.length > 5000) {
        return NextResponse.json({ error: "توضیحات بیش از حد طولانی است." }, { status: 400 });
      }
    }
    if (body.status !== undefined) {
      if (!PROJECT_STATUSES.includes(body.status)) {
        return NextResponse.json({ error: "وضعیت پروژه نامعتبر است." }, { status: 400 });
      }
      update.status = body.status;
    }

    const start = body.startAt !== undefined ? parseOptionalDate(body.startAt) : null;
    const due = body.dueAt !== undefined ? parseOptionalDate(body.dueAt) : null;
    if ((start && !start.ok) || (due && !due.ok)) {
      return NextResponse.json({ error: "تاریخ واردشده معتبر نیست." }, { status: 400 });
    }
    if (start) update.startAt = start.value;
    if (due) update.dueAt = due.value;

    const finalStart = start ? start.value : existing.startAt;
    const finalDue = due ? due.value : existing.dueAt;
    if (finalStart && finalDue && new Date(finalDue) < new Date(finalStart)) {
      return NextResponse.json({ error: "مهلت پروژه نمی‌تواند قبل از تاریخ شروع باشد." }, { status: 400 });
    }

    if (body.memberIds !== undefined) {
      update.memberIds = await filterActiveMemberIds(current.workspace.id, body.memberIds);
    }

    await connectToDatabase();
    const project = await Project.findOneAndUpdate(
      { _id: params.projectId, workspaceId: current.workspace.id },
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!project) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });

    // ---- activity log + notifications
    const sameDate = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);
    const base = { entityType: "project", entityId: project._id, entityTitle: project.name, project };

    if (update.status !== undefined && update.status !== existing.status) {
      await logActivity(current, { ...base, type: "project.status_changed", meta: { to: update.status } });
    }

    if (update.memberIds !== undefined) {
      const before = existing.memberIds.map(String);
      const after = update.memberIds.map(String);
      const added = after.filter((id) => !before.includes(id));
      const removed = before.filter((id) => !after.includes(id));
      if (added.length || removed.length) {
        const names = await userNameMap([...added, ...removed]);
        await logActivity(current, {
          ...base,
          type: "project.members_changed",
          meta: { added: added.map((id) => names.get(id) || "کاربر"), removed: removed.map((id) => names.get(id) || "کاربر") },
        });
        await notify(current, added, { ...base, type: "project.member_added" });
      }
    }

    const changedFields = [];
    if (update.name !== undefined && update.name !== existing.name) changedFields.push("name");
    if (update.description !== undefined && update.description !== (existing.description || "")) changedFields.push("description");
    if (update.startAt !== undefined && !sameDate(update.startAt, existing.startAt)) changedFields.push("startAt");
    if (update.dueAt !== undefined && !sameDate(update.dueAt, existing.dueAt)) changedFields.push("dueAt");
    if (changedFields.length) await logActivity(current, { ...base, type: "project.updated", meta: { fields: changedFields } });

    return NextResponse.json({ project: serializeProject(project) });
  } catch (error) {
    console.error("PROJECT_UPDATE_ERROR", error);
    return NextResponse.json({ error: "ویرایش پروژه انجام نشد." }, { status: 500 });
  }
}

export async function DELETE(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  if (!hasPermission(current, "projects.manage")) {
    return NextResponse.json({ error: "اجازه حذف پروژه ندارید." }, { status: 403 });
  }

  if (!mongoose.isValidObjectId(params.projectId)) {
    return NextResponse.json({ error: "شناسه پروژه نامعتبر است." }, { status: 400 });
  }

  await connectToDatabase();
  const project = await Project.findOneAndDelete({
    _id: params.projectId,
    workspaceId: current.workspace.id,
  });

  if (!project) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });
  // do not leave orphan tasks behind
  await Task.deleteMany({ projectId: project._id, workspaceId: current.workspace.id });
  await logActivity(current, { type: "project.deleted", entityType: "project", entityId: project._id, entityTitle: project.name, project });
  return NextResponse.json({ ok: true });
}
