import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";
import { findAccessibleProject } from "../../../../../lib/project-access";
import { assigneeError, commentCountsFor, serializeTask } from "../../../../../lib/tasks";
import { logActivity, notify, userNameMap } from "../../../../../lib/activity";
import { parseOptionalDate } from "../../../../../lib/validation";
import Task, { TASK_PRIORITIES, TASK_STATUSES } from "../../../../../database/models/Task";
import { limitUser } from "../../../../../lib/user-limit";

export const runtime = "nodejs";

export async function GET(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const project = await findAccessibleProject(current, params.projectId);
  if (!project) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });

  const tasks = await Task.find({ workspaceId: current.workspace.id, projectId: project._id })
    .sort({ createdAt: -1 })
    .lean();
  const counts = await commentCountsFor(tasks.map((t) => t._id));
  const now = new Date();

  return NextResponse.json({
    tasks: tasks.map((t) => serializeTask(t, { projectName: project.name, commentCount: counts.get(String(t._id)) || 0, now })),
  });
}

// Any member of the project (or a manager) can create tasks for themselves or other project members.
export async function POST(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const limited = await limitUser(current, "task:create");
  if (limited) return limited;

  const project = await findAccessibleProject(current, params.projectId);
  if (!project) return NextResponse.json({ error: "پروژه پیدا نشد." }, { status: 404 });

  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const status = body.status || "todo";
    const priority = body.priority || "medium";

    if (title.length < 2 || title.length > 240) {
      return NextResponse.json({ error: "عنوان وظیفه باید بین ۲ تا ۲۴۰ کاراکتر باشد." }, { status: 400 });
    }
    if (description.length > 10000) {
      return NextResponse.json({ error: "توضیحات بیش از حد طولانی است." }, { status: 400 });
    }
    if (!TASK_STATUSES.includes(status) || !TASK_PRIORITIES.includes(priority)) {
      return NextResponse.json({ error: "وضعیت یا اولویت نامعتبر است." }, { status: 400 });
    }

    const assigneeId = body.assigneeId || null;
    const problem = assigneeError(project, assigneeId);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const start = parseOptionalDate(body.startAt);
    const due = parseOptionalDate(body.dueAt);
    if (!start.ok || !due.ok) return NextResponse.json({ error: "تاریخ واردشده معتبر نیست." }, { status: 400 });
    if (start.value && due.value && due.value < start.value) {
      return NextResponse.json({ error: "مهلت نمی‌تواند قبل از تاریخ شروع باشد." }, { status: 400 });
    }

    await connectToDatabase();
    const task = await Task.create({
      workspaceId: current.workspace.id,
      projectId: project._id,
      title,
      description,
      status,
      priority,
      createdBy: current.user.id,
      assigneeId,
      startAt: start.value,
      dueAt: due.value,
      completedAt: status === "done" ? new Date() : null,
    });

    const names = assigneeId ? await userNameMap([assigneeId]) : new Map();
    await logActivity(current, {
      type: "task.created",
      entityType: "task",
      entityId: task._id,
      entityTitle: title,
      project,
      meta: { assigneeName: assigneeId && assigneeId !== current.user.id ? names.get(String(assigneeId)) || "" : "" },
    });
    if (assigneeId) {
      await notify(current, [assigneeId], { type: "task.assigned", entityType: "task", entityId: task._id, entityTitle: title, project });
    }

    return NextResponse.json(
      { task: serializeTask(task.toObject(), { projectName: project.name, commentCount: 0 }) },
      { status: 201 }
    );
  } catch (error) {
    console.error("TASK_CREATE_ERROR", error);
    return NextResponse.json({ error: "ایجاد وظیفه انجام نشد." }, { status: 500 });
  }
}
