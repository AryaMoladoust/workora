import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";
import { hasPermission } from "../../../../../lib/permissions";
import { findAccessibleProject } from "../../../../../lib/project-access";
import { sanitizeLabels } from "../../../../../lib/task-logic";
import { limitUser } from "../../../../../lib/user-limit";
import Project from "../../../../../database/models/Project";
import Task from "../../../../../database/models/Task";

export const runtime = "nodejs";

const bad = (error, status = 400) => NextResponse.json({ error }, { status });

// PUT { labels: [{ id?, name, color }] } - replaces the label list of the project (project managers only).
// Labels that disappear from the list are removed from every task of the project.
export async function PUT(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const limited = await limitUser(current, "project");
  if (limited) return limited;
  if (!hasPermission(current, "projects.manage")) return bad("برای مدیریت برچسب‌ها اجازه‌ی مدیریت پروژه‌ها لازم است.", 403);
  if (!mongoose.isValidObjectId(params.projectId)) return bad("شناسه نامعتبر است.");

  const project = await findAccessibleProject(current, params.projectId);
  if (!project) return bad("پروژه پیدا نشد.", 404);

  const body = await request.json().catch(() => ({}));
  const labels = sanitizeLabels(body.labels, project.labels);

  await connectToDatabase();
  await Project.updateOne({ _id: project._id, workspaceId: current.workspace.id }, { $set: { labels } });

  const removed = (project.labels || []).map((l) => l.id).filter((id) => !labels.some((l) => l.id === id));
  if (removed.length) {
    await Task.updateMany({ workspaceId: current.workspace.id, projectId: project._id, labelIds: { $in: removed } }, { $pull: { labelIds: { $in: removed } } });
  }
  return NextResponse.json({ labels });
}
