import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { notifySystem } from "../../../../lib/activity";
import { reminderFor } from "../../../../lib/task-logic";
import Project from "../../../../database/models/Project";
import Task from "../../../../database/models/Task";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily job (vercel.json → crons). Sends "due today / due tomorrow" and "overdue" reminders to the person a task
// is assigned to. Every reminder is sent ONCE per due date (Task.reminders; cleared when the due date changes).
// Vercel calls this with  Authorization: Bearer <CRON_SECRET>  - set CRON_SECRET in the environment variables.
// Locally:  curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET تنظیم نشده است." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "دسترسی غیرمجاز." }, { status: 401 });

  await connectToDatabase();
  const now = new Date();
  // due within the next 2 days or overdue by up to 3 days (older ones are ignored on purpose)
  const tasks = await Task.find({
    status: { $ne: "done" },
    assigneeId: { $ne: null },
    dueAt: { $ne: null, $lte: new Date(now.getTime() + 2 * 86400000), $gte: new Date(now.getTime() - 5 * 86400000) },
  })
    .select("workspaceId projectId title dueAt status assigneeId reminders")
    .limit(5000)
    .lean();

  const projects = await Project.find({ _id: { $in: [...new Set(tasks.map((t) => String(t.projectId)))] }, status: "active" }).select("name").lean();
  const projectById = new Map(projects.map((p) => [String(p._id), p]));

  const result = { checked: tasks.length, due_soon: 0, overdue: 0, skipped: 0 };
  for (const task of tasks) {
    const project = projectById.get(String(task.projectId));
    const reminder = project ? reminderFor(task, now) : null; // finished / archived projects get no reminders
    if (!reminder) {
      result.skipped += 1;
      continue;
    }
    const sent = await notifySystem(task.workspaceId, [task.assigneeId], {
      type: reminder.kind === "overdue" ? "task.overdue" : "task.due_soon",
      entityType: "task",
      entityId: task._id,
      entityTitle: task.title,
      project,
      meta: { days: reminder.days },
    });
    // mark it as sent even when nobody could be notified (inactive assignee) so it is not retried every day
    await Task.updateOne({ _id: task._id }, { $set: { [reminder.kind === "overdue" ? "reminders.overdueAt" : "reminders.dueSoonAt"]: now } });
    if (sent) result[reminder.kind] += 1;
  }
  return NextResponse.json({ ok: true, ...result });
}
