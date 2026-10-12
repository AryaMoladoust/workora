import Link from "next/link";
import { notFound } from "next/navigation";
import Icon from "../../../components/ui/Icon";
import ProjectTabs from "../../../components/projects/ProjectTabs";
import { Avatar } from "../../../components/dashboard/widgets";
import { requireAuth } from "../../../lib/require-auth";
import { connectToDatabase } from "../../../lib/db";
import { hasPermission } from "../../../lib/permissions";
import { getProjectForPage } from "../../../lib/project-access";
import { fa, fullDate, hueFromString, PROJECT_STATUS_LABELS } from "../../../lib/format";
import User from "../../../database/models/User";

export const dynamic = "force-dynamic";

export default async function ProjectLayout({ children, params }) {
  params = await params;
  const current = await requireAuth();
  const project = await getProjectForPage(current, params.projectId);
  if (!project) notFound();

  await connectToDatabase();
  const shownIds = project.memberIds.slice(0, 5);
  const users = shownIds.length ? await User.find({ _id: { $in: shownIds } }).select("firstName lastName").lean() : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const members = shownIds
    .map((id) => userById.get(String(id)))
    .filter(Boolean)
    .map((u) => ({ id: String(u._id), firstName: u.firstName, lastName: u.lastName }));
  const extra = Math.max(0, project.memberIds.length - members.length);
  const canEdit = hasPermission(current, "projects.manage");

  return (
    <div className="page-shell project-page">
      <Link href="/projects" className="back-link">← پروژه‌ها</Link>

      <section className="project-head card" style={{ "--h": hueFromString(String(project._id)) }}>
        <span className="project-head-icon"><Icon name="folder" size={26} /></span>
        <div className="project-head-main">
          <div className="project-head-title">
            <h1>{project.name}</h1>
            <span className={`project-status project-status-${project.status}`}>{PROJECT_STATUS_LABELS[project.status]}</span>
          </div>
          {project.description && <p>{project.description}</p>}
          <div className="project-head-meta">
            {project.startAt && <span><Icon name="calendar" size={15} />شروع: {fullDate(project.startAt)}</span>}
            {project.dueAt && <span><Icon name="clock" size={15} />مهلت: {fullDate(project.dueAt)}</span>}
          </div>
        </div>
        <div className="project-head-team">
          <div className="avatar-stack avatar-stack-sm">
            {members.map((m) => <Avatar key={m.id} {...m} size="sm" />)}
            {extra > 0 && <span className="avatar avatar-sm avatar-more">+{fa(extra)}</span>}
          </div>
          <small>{fa(project.memberIds.length)} عضو</small>
        </div>
      </section>

      <ProjectTabs projectId={String(project._id)} canEdit={canEdit} />
      <div className="project-body">{children}</div>
    </div>
  );
}
