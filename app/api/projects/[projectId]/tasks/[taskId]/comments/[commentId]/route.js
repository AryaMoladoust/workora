import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../../../lib/auth";
import { findAccessibleProject } from "../../../../../../../../lib/project-access";
import { isTaskManager } from "../../../../../../../../lib/tasks";
import { canDeleteComment } from "../../../../../../../../lib/task-rules";
import Comment from "../../../../../../../../database/models/Comment";
import { limitUser } from "../../../../../../../../lib/user-limit";

export const runtime = "nodejs";

export async function DELETE(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const limited = await limitUser(current, "comment");
  if (limited) return limited;

  const ids = [params.projectId, params.taskId, params.commentId];
  if (!ids.every((id) => mongoose.isValidObjectId(id))) {
    return NextResponse.json({ error: "شناسه نامعتبر است." }, { status: 400 });
  }

  const project = await findAccessibleProject(current, params.projectId);
  if (!project) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });

  await connectToDatabase();
  const comment = await Comment.findOne({ _id: params.commentId, taskId: params.taskId, projectId: project._id }).lean();
  if (!comment) return NextResponse.json({ error: "کامنت پیدا نشد." }, { status: 404 });

  if (!canDeleteComment({ isManager: isTaskManager(current), userId: current.user.id }, comment)) {
    return NextResponse.json({ error: "اجازه حذف این کامنت را ندارید." }, { status: 403 });
  }

  await Comment.deleteOne({ _id: comment._id });
  return NextResponse.json({ ok: true });
}
