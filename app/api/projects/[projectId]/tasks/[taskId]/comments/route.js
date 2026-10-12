import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../../lib/auth";
import { findAccessibleProject } from "../../../../../../../lib/project-access";
import { serializeComment } from "../../../../../../../lib/tasks";
import { logActivity, notify } from "../../../../../../../lib/activity";
import Task from "../../../../../../../database/models/Task";
import Comment from "../../../../../../../database/models/Comment";
import User from "../../../../../../../database/models/User";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function loadTaskWithProject(current, params) {
  if (!mongoose.isValidObjectId(params.projectId) || !mongoose.isValidObjectId(params.taskId)) return null;
  const project = await findAccessibleProject(current, params.projectId);
  if (!project) return null;
  await connectToDatabase();
  const task = await Task.findOne({ _id: params.taskId, projectId: project._id, workspaceId: current.workspace.id }).lean();
  return task ? { task, project } : null;
}

async function loadTask(current, params) {
  const found = await loadTaskWithProject(current, params);
  return found ? found.task : null;
}

export async function GET(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);

  const task = await loadTask(current, params);
  if (!task) return bad("وظیفه پیدا نشد.", 404);

  const comments = await Comment.find({ taskId: task._id }).sort({ createdAt: 1 }).limit(500).lean();
  const users = await User.find({ _id: { $in: [...new Set(comments.map((c) => String(c.authorId)))] } })
    .select("firstName lastName")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  return NextResponse.json({ comments: comments.map((c) => serializeComment(c, byId.get(String(c.authorId)))) });
}

export async function POST(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);

  const found = await loadTaskWithProject(current, params);
  if (!found) return bad("وظیفه پیدا نشد.", 404);
  const { task, project } = found;

  try {
    const body = await request.json();
    const text = String(body.body || "").trim();
    if (text.length < 1 || text.length > 3000) return bad("متن کامنت باید بین ۱ تا ۳۰۰۰ کاراکتر باشد.");

    const comment = await Comment.create({
      workspaceId: current.workspace.id,
      projectId: task.projectId,
      taskId: task._id,
      authorId: current.user.id,
      body: text,
    });

    const meta = { snippet: text.slice(0, 120) };
    const base = { entityType: "comment", entityId: task._id, entityTitle: task.title, project, meta };
    await logActivity(current, { ...base, type: "comment.created" });
    await notify(current, [task.createdBy, task.assigneeId], { ...base, type: "comment.created" });

    return NextResponse.json(
      { comment: serializeComment(comment.toObject(), { firstName: current.user.firstName, lastName: current.user.lastName }) },
      { status: 201 }
    );
  } catch (error) {
    console.error("COMMENT_CREATE_ERROR", error);
    return bad("ثبت کامنت انجام نشد.", 500);
  }
}
