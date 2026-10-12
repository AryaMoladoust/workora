import { notFound } from "next/navigation";
import { requireAuth } from "../../../../lib/require-auth";
import { connectToDatabase } from "../../../../lib/db";
import { getProjectForPage } from "../../../../lib/project-access";
import { listWorkspaceMembers } from "../../../../lib/members";
import { commentCountsFor, isTaskManager, serializeTask } from "../../../../lib/tasks";
import TaskWorkspace from "../../../../components/tasks/TaskWorkspace";
import Task from "../../../../database/models/Task";

export const dynamic = "force-dynamic";

export default async function ProjectTasksPage({ params, searchParams }) {
  params = await params;
  searchParams = await searchParams;
  const current = await requireAuth();
  const project = await getProjectForPage(current, params.projectId);
  if (!project) notFound();

  await connectToDatabase();
  const [tasks, members] = await Promise.all([
    Task.find({ workspaceId: current.workspace.id, projectId: project._id }).sort({ createdAt: -1 }).limit(1000).lean(),
    listWorkspaceMembers(current.workspace.id, { includeInactive: true }),
  ]);
  const counts = await commentCountsFor(tasks.map((t) => t._id));
  const now = new Date();
  const memberIds = project.memberIds.map(String);

  const initialTasks = tasks.map((t) =>
    serializeTask(t, { projectName: project.name, commentCount: counts.get(String(t._id)) || 0, now })
  );
  const people = members
    .filter((m) => memberIds.includes(m.userId) || tasks.some((t) => String(t.assigneeId) === m.userId))
    .map(({ userId, firstName, lastName, isActive }) => ({ userId, firstName, lastName, isActive }));

  return (
    <TaskWorkspace
      key={typeof searchParams?.task === "string" ? searchParams.task : "none"}
      layout="project"
      initialTasks={initialTasks}
      projects={[{ id: String(project._id), name: project.name, memberIds }]}
      people={people}
      fixedProjectId={String(project._id)}
      ctx={{ userId: current.user.id, isManager: isTaskManager(current) }}
      openTaskId={typeof searchParams?.task === "string" ? searchParams.task : null}
    />
  );
}
