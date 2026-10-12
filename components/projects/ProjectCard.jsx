import Link from "next/link";
import Icon from "../ui/Icon";
import { Avatar } from "../dashboard/widgets";
import { fa, dueInfo, hueFromString, PROJECT_STATUS_LABELS } from "../../lib/format";

export default function ProjectCard({ project, now }) {
  const due = project.dueAt ? dueInfo(project.dueAt, new Date(now)) : null;
  const extra = Math.max(0, project.memberCount - project.members.length);

  return (
    <Link href={`/projects/${project.id}`} className="project-card" style={{ "--h": hueFromString(project.id) }}>
      <div className="project-card-top">
        <span className="project-card-icon"><Icon name="folder" size={20} /></span>
        <span className={`project-status project-status-${project.status}`}>{PROJECT_STATUS_LABELS[project.status]}</span>
      </div>

      <div className="project-card-body">
        <h3>{project.name}</h3>
        <p>{project.description || "بدون توضیحات"}</p>
      </div>

      <div className="project-card-progress">
        <div className="pp-head">
          <small>{project.total ? `${fa(project.done)} از ${fa(project.total)} وظیفه` : "هنوز وظیفه‌ای نیست"}</small>
          <span className="pp-percent">{fa(project.percent)}٪</span>
        </div>
        <div className="progress"><span style={{ width: `${project.percent}%` }} /></div>
      </div>

      <footer className="project-card-foot">
        <div className="avatar-stack avatar-stack-sm">
          {project.members.map((m) => (
            <Avatar key={m.id} {...m} size="sm" />
          ))}
          {extra > 0 && <span className="avatar avatar-sm avatar-more">+{fa(extra)}</span>}
        </div>
        <div className="project-card-flags">
          {project.overdue > 0 && (
            <span className="due due-overdue"><Icon name="alert" size={14} />{fa(project.overdue)} عقب‌افتاده</span>
          )}
          {due && project.status === "active" && (
            <span className={`due due-${due.tone}`}><Icon name="calendar" size={14} />{due.text}</span>
          )}
        </div>
      </footer>
    </Link>
  );
}
