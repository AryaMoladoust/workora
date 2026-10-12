import { notFound } from "next/navigation";
import { requireAuth } from "../../../../lib/require-auth";
import { hasPermission } from "../../../../lib/permissions";
import { getProjectForPage } from "../../../../lib/project-access";
import { listWorkspaceMembers } from "../../../../lib/members";
import { Card, Avatar } from "../../../../components/dashboard/widgets";
import ProjectMembersEditor from "../../../../components/projects/ProjectMembersEditor";

export const dynamic = "force-dynamic";

export default async function ProjectMembersPage({ params }) {
  params = await params;
  const current = await requireAuth();
  const project = await getProjectForPage(current, params.projectId);
  if (!project) notFound();

  const canEdit = hasPermission(current, "projects.manage");
  const members = await listWorkspaceMembers(current.workspace.id);
  const slim = members.map(({ userId, firstName, lastName, role }) => ({ userId, firstName, lastName, role }));
  const memberIds = project.memberIds.map(String);

  if (canEdit) {
    return (
      <Card title="اعضای پروژه" icon="users">
        <p className="field-hint" style={{ marginBottom: 14 }}>
          فقط اعضای انتخاب‌شده این پروژه را می‌بینند و می‌توانند در آن کار کنند.
        </p>
        <ProjectMembersEditor projectId={String(project._id)} members={slim} initialMemberIds={memberIds} />
      </Card>
    );
  }

  const inProject = slim.filter((m) => memberIds.includes(m.userId));
  return (
    <Card title="اعضای پروژه" icon="users">
      <ul className="team-list team-list-wide">
        {inProject.map((m) => (
          <li key={m.userId}>
            <Avatar id={m.userId} firstName={m.firstName} lastName={m.lastName} size="sm" />
            <span>{m.firstName} {m.lastName}</span>
            <span className={`chip ${m.role === "owner" ? "chip-owner" : "chip-member"}`}>{m.role === "owner" ? "مالک" : "عضو"}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
