import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { hasPermission } from "../../../lib/permissions";
import { projectScope } from "../../../lib/project-access";
import { filterActiveMemberIds } from "../../../lib/members";
import { parseOptionalDate } from "../../../lib/validation";
import { serializeProject } from "../../../lib/projects";
import { logActivity, notify } from "../../../lib/activity";
import Project, { PROJECT_STATUSES } from "../../../database/models/Project";
import { limitUser } from "../../../lib/user-limit";

export const runtime = "nodejs";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  await connectToDatabase();
  const projects = await Project.find(projectScope(current)).sort({ createdAt: -1 }).lean();
  return NextResponse.json({ projects: projects.map(serializeProject) });
}

export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const limited = await limitUser(current, "project:create");
  if (limited) return limited;
  if (!hasPermission(current, "projects.manage")) {
    return NextResponse.json({ error: "اجازه ایجاد پروژه ندارید." }, { status: 403 });
  }

  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const status = body.status && PROJECT_STATUSES.includes(body.status) ? body.status : "active";

    if (name.length < 2 || name.length > 160) {
      return NextResponse.json({ error: "نام پروژه باید بین ۲ تا ۱۶۰ کاراکتر باشد." }, { status: 400 });
    }
    if (description.length > 5000) {
      return NextResponse.json({ error: "توضیحات بیش از حد طولانی است." }, { status: 400 });
    }

    const start = parseOptionalDate(body.startAt);
    const due = parseOptionalDate(body.dueAt);
    if (!start.ok || !due.ok) return NextResponse.json({ error: "تاریخ واردشده معتبر نیست." }, { status: 400 });
    if (start.value && due.value && due.value < start.value) {
      return NextResponse.json({ error: "مهلت پروژه نمی‌تواند قبل از تاریخ شروع باشد." }, { status: 400 });
    }

    const requested = await filterActiveMemberIds(current.workspace.id, body.memberIds);
    const memberIds = [...new Set([current.user.id, ...requested])];

    await connectToDatabase();
    const project = await Project.create({
      workspaceId: current.workspace.id,
      name,
      description,
      status,
      createdBy: current.user.id,
      memberIds,
      startAt: start.value,
      dueAt: due.value,
    });

    await logActivity(current, { type: "project.created", entityType: "project", entityId: project._id, entityTitle: name, project });
    await notify(current, memberIds, { type: "project.member_added", entityType: "project", entityId: project._id, entityTitle: name, project });

    return NextResponse.json({ project: serializeProject(project.toObject()) }, { status: 201 });
  } catch (error) {
    console.error("PROJECT_CREATE_ERROR", error);
    return NextResponse.json({ error: "ایجاد پروژه انجام نشد." }, { status: 500 });
  }
}
