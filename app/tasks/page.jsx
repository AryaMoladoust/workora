import Link from "next/link";
import { requireAuth } from "../../lib/require-auth";
import { connectToDatabase } from "../../lib/db";
import { projectScope } from "../../lib/project-access";
import { listWorkspaceMembers } from "../../lib/members";
import { blockerMapFor, commentCountsFor, isTaskManager, serializeTask } from "../../lib/tasks";
import { fa } from "../../lib/format";
import TaskWorkspace from "../../components/tasks/TaskWorkspace";
import Project from "../../database/models/Project";
import Task from "../../database/models/Task";

export const dynamic = "force-dynamic";

const SCOPES = [
  ["assigned", "سپرده‌شده به من"],
  ["created", "ساخته‌شده توسط من"],
  ["all", "همه وظایف پروژه‌هایم"],
];

export default async function MyTasksPage({ searchParams }) {
  searchParams = await searchParams;
  const current = await requireAuth();
  const scope = SCOPES.some(([id]) => id === searchParams?.scope) ? searchParams.scope : "assigned";

  await connectToDatabase();
  const projects = await Project.find(projectScope(current)).sort({ updatedAt: -1 }).limit(300).lean();
  const projectIds = projects.map((p) => p._id);
  const projectName = new Map(projects.map((p) => [String(p._id), p.name]));

  const filter = { workspaceId: current.workspace.id, projectId: { $in: projectIds } };
  if (scope === "assigned") filter.assigneeId = current.user.id;
  if (scope === "created") filter.createdBy = current.user.id;

  const tasks = await Task.find(filter).sort({ createdAt: -1 }).limit(500).lean();
  const [counts, blockerMap] = await Promise.all([commentCountsFor(tasks.map((t) => t._id)), blockerMapFor(tasks)]);
  const now = new Date();
  const labelsOf = new Map(projects.map((p) => [String(p._id), p.labels || []]));

  const initialTasks = tasks.map((t) =>
    serializeTask(t, { projectName: projectName.get(String(t.projectId)) || "پروژه", commentCount: counts.get(String(t._id)) || 0, now, blockerMap, projectLabels: labelsOf.get(String(t.projectId)) })
  );

  const members = await listWorkspaceMembers(current.workspace.id, { includeInactive: true });
  const people = members.map(({ userId, firstName, lastName, isActive }) => ({ userId, firstName, lastName, isActive }));

  // projects offered when creating a task (finished/archived ones are hidden)
  const createProjects = projects
    .filter((p) => p.status === "active")
    .map((p) => ({ id: String(p._id), name: p.name, memberIds: p.memberIds.map(String), labels: (p.labels || []).map((l) => ({ id: l.id, name: l.name, color: l.color })) }));

  const open = initialTasks.filter((t) => t.status !== "done").length;
  const overdue = initialTasks.filter((t) => t.status !== "done" && t.dueTone === "overdue").length;

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Tasks</span>
          <h1>وظایف من</h1>
          <p>
            {fa(open)} وظیفه باز
            {overdue > 0 && <> · <span className="text-danger">{fa(overdue)} عقب‌افتاده</span></>}
          </p>
        </div>
      </div>

      <div className="scope-tabs filter-tabs" role="tablist">
        {SCOPES.map(([id, label]) => (
          <Link key={id} href={id === "assigned" ? "/tasks" : `/tasks?scope=${id}`} className={scope === id ? "is-active" : ""}>
            {label}
          </Link>
        ))}
      </div>

      <TaskWorkspace
        key={`${scope}-${typeof searchParams?.task === "string" ? searchParams.task : "none"}`}
        layout="mine"
        initialTasks={initialTasks}
        projects={createProjects}
        people={people}
        ctx={{ userId: current.user.id, isManager: isTaskManager(current) }}
        openTaskId={typeof searchParams?.task === "string" ? searchParams.task : null}
      />
    </div>
  );
}
