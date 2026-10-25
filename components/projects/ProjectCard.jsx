import Link from "next/link";
import Icon from "../ui/Icon";
import { Avatar } from "../dashboard/widgets";
import { fa, dueInfo, hueFromString, PROJECT_STATUS_LABELS } from "../../lib/format";

// A project drawn as a glass folder: marbled back with a tab, a few papers peeking out and a frosted front panel.
// The whole folder opens the project (stretched link); the round "+" button goes straight to the tasks.
export default function ProjectCard({ project, now }) {
  const due = project.dueAt ? dueInfo(project.dueAt, new Date(now)) : null;
  const extra = Math.max(0, project.memberCount - project.members.length);
  const hue = hueFromString(project.id);

  return (
    <article className={`pfolder pfolder-${project.status}`} style={{ "--h": hue }}>
      <span className="pfolder-back" aria-hidden="true" />
      <span className="pfolder-tab" aria-hidden="true" />

      <span className="pfolder-paper pfolder-paper-1" aria-hidden="true">
        <b>{project.total ? `${fa(project.total)} وظیفه` : "بدون وظیفه"}</b>
        <i /><i />
      </span>
      <span className="pfolder-paper pfolder-paper-2" aria-hidden="true">
        <b>{PROJECT_STATUS_LABELS[project.status]}</b>
        <i /><i /><i />
      </span>
      <span className="pfolder-paper pfolder-paper-3" aria-hidden="true">
        <b>{project.overdue > 0 ? `${fa(project.overdue)} عقب‌افتاده` : due ? due.text : `${fa(project.percent)}٪ انجام شده`}</b>
        <i /><i />
      </span>

      <div className="pfolder-front">
        <div className="pfolder-top">
          <span className={`pfolder-status project-status-${project.status}`}>{PROJECT_STATUS_LABELS[project.status]}</span>
          {project.overdue > 0 && <span className="pfolder-flag"><Icon name="alert" size={13} />{fa(project.overdue)}</span>}
        </div>

        <h3 className="pfolder-name">
          <Link href={`/projects/${project.id}`} className="pfolder-link">{project.name}</Link>
        </h3>
        <p className="pfolder-meta">
          {project.total ? `${fa(project.done)}/${fa(project.total)} وظیفه` : "هنوز وظیفه‌ای نیست"}
          {due && project.status === "active" ? ` · ${due.text}` : ""}
        </p>

        <div className="pfolder-progress" role="progressbar" aria-valuenow={project.percent} aria-valuemin={0} aria-valuemax={100} aria-label="پیشرفت پروژه">
          <span style={{ width: `${project.percent}%` }} />
        </div>

        <div className="pfolder-foot">
          <Link href={`/projects/${project.id}/tasks`} className="pfolder-plus" aria-label={`وظایف ${project.name}`} title="وظایف پروژه">
            <Icon name="plus" size={18} strokeWidth={2.4} />
          </Link>
          <span className="pfolder-people" title={`${project.memberCount} عضو`}>
            <span className="avatar-stack avatar-stack-sm">
              {project.members.slice(0, 3).map((m) => <Avatar key={m.id} {...m} size="sm" />)}
            </span>
            {(extra > 0 || project.members.length > 3) && <small>+{fa(Math.max(extra, project.memberCount - 3))}</small>}
          </span>
        </div>
      </div>
    </article>
  );
}
