import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "../../../lib/require-auth";
import { hasPermission } from "../../../lib/permissions";
import { listWorkspaceMembers } from "../../../lib/members";
import ProjectForm from "../../../components/projects/ProjectForm";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const current = await requireAuth();
  if (!hasPermission(current, "projects.manage")) redirect("/projects");

  const members = await listWorkspaceMembers(current.workspace.id);

  return (
    <div className="page-shell narrow-page">
      <Link href="/projects" className="back-link">← پروژه‌ها</Link>
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Projects</span>
          <h1>پروژه جدید</h1>
          <p>اطلاعات پروژه را وارد کنید و اعضای آن را انتخاب کنید.</p>
        </div>
      </div>
      <ProjectForm
        mode="create"
        members={members.map(({ userId, firstName, lastName, role }) => ({ userId, firstName, lastName, role }))}
        currentUserId={current.user.id}
      />
    </div>
  );
}
