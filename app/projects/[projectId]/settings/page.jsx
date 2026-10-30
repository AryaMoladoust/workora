import { notFound, redirect } from "next/navigation";
import { requireAuth } from "../../../../lib/require-auth";
import { hasPermission } from "../../../../lib/permissions";
import { getProjectForPage } from "../../../../lib/project-access";
import { toDateInput } from "../../../../lib/format";
import ProjectForm from "../../../../components/projects/ProjectForm";
import DeleteProject from "../../../../components/projects/DeleteProject";
import LabelsManager from "../../../../components/projects/LabelsManager";

export const dynamic = "force-dynamic";

export default async function ProjectSettingsPage({ params }) {
  params = await params;
  const current = await requireAuth();
  const project = await getProjectForPage(current, params.projectId);
  if (!project) notFound();
  if (!hasPermission(current, "projects.manage")) redirect(`/projects/${params.projectId}`);

  return (
    <div className="stack">
      <ProjectForm
        mode="edit"
        projectId={String(project._id)}
        initial={{
          name: project.name,
          description: project.description,
          status: project.status,
          startAt: toDateInput(project.startAt),
          dueAt: toDateInput(project.dueAt),
          memberIds: project.memberIds.map(String),
        }}
        members={[]}
      />
      <LabelsManager projectId={String(project._id)} initial={(project.labels || []).map((l) => ({ id: l.id, name: l.name, color: l.color }))} />
      <DeleteProject projectId={String(project._id)} projectName={project.name} />
    </div>
  );
}
