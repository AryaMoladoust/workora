import Link from "next/link";
import Icon from "../ui/Icon";
import {
  fa,
  dueInfo,
  initials,
  hueFromString,
  STATUS_LABELS,
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
} from "../../lib/format";

/* ---------------------------------------------------------------- Card */
export function Card({ title, icon, action, className = "", children }) {
  return (
    <section className={`card ${className}`}>
      <header className="card-head">
        <h3 className="card-title">
          {icon && <span className="card-title-icon"><Icon name={icon} size={17} /></span>}
          {title}
        </h3>
        {action}
      </header>
      {children}
    </section>
  );
}

export function CardLink({ href, children }) {
  return (
    <Link href={href} className="card-link">
      {children}
      <Icon name="arrowLeft" size={15} />
    </Link>
  );
}

/* ---------------------------------------------------------------- Stats */
export function StatCard({ icon, label, value, hint, tone = "accent" }) {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-icon"><Icon name={icon} size={20} /></span>
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <strong className="stat-value">{fa(value)}</strong>
        {hint && <small className="stat-hint">{hint}</small>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Upcoming tasks */
export function UpcomingTasks({ tasks, now }) {
  if (tasks.length === 0) {
    return (
      <div className="empty-inline">
        <span className="empty-inline-icon"><Icon name="check" size={22} /></span>
        <strong>وظیفه بازی ندارید</strong>
        <p>وقتی وظیفه‌ای به شما سپرده شود، اینجا نمایش داده می‌شود.</p>
      </div>
    );
  }

  return (
    <ul className="task-rows">
      {tasks.map((task) => {
        const due = dueInfo(task.dueAt, new Date(now));
        return (
          <li key={task.id}>
            <Link href={`/projects/${task.projectId}/tasks?task=${task.id}`} className="task-row">
              <span className={`prio-dot prio-${task.priority}`} title={`اولویت ${PRIORITY_LABELS[task.priority]}`} />
              <span className="task-row-main">
                <strong>{task.title}</strong>
                <small>{task.projectName}</small>
              </span>
              <span className={`chip chip-${task.status}`}>{STATUS_LABELS[task.status]}</span>
              <span className={`due due-${due.tone}`}>
                {due.tone !== "none" && <Icon name={due.tone === "overdue" ? "alert" : "clock"} size={14} />}
                {due.text}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------------------------------------------------------------- Donut */
export function StatusDonut({ counts, total, percentDone }) {
  const legend = [
    { key: "done", label: STATUS_LABELS.done, color: "var(--c-done)" },
    { key: "in_progress", label: STATUS_LABELS.in_progress, color: "var(--c-progress)" },
    { key: "todo", label: STATUS_LABELS.todo, color: "var(--c-todo)" },
  ];

  let background = "var(--surface-2)";
  if (total > 0) {
    const a = (counts.done / total) * 100;
    const b = a + (counts.in_progress / total) * 100;
    background = `conic-gradient(var(--c-done) 0 ${a}%, var(--c-progress) ${a}% ${b}%, var(--c-todo) ${b}% 100%)`;
  }

  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background }} role="img" aria-label={`${fa(percentDone)} درصد وظایف انجام شده`}>
        <div className="donut-hole">
          <strong>{fa(percentDone)}٪</strong>
          <small>انجام شده</small>
        </div>
      </div>
      <ul className="legend">
        {legend.map((item) => (
          <li key={item.key}>
            <span className="legend-dot" style={{ background: item.color }} />
            <span className="legend-label">{item.label}</span>
            <strong>{fa(counts[item.key])}</strong>
          </li>
        ))}
        <li className="legend-total">
          <span className="legend-label">مجموع وظایف</span>
          <strong>{fa(total)}</strong>
        </li>
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------- Projects progress */
export function ProjectProgress({ projects }) {
  if (projects.length === 0) {
    return (
      <div className="empty-inline">
        <span className="empty-inline-icon"><Icon name="folder" size={22} /></span>
        <strong>هنوز پروژه فعالی وجود ندارد</strong>
        <p>اولین پروژه را بسازید تا پیشرفت آن اینجا دیده شود.</p>
        <Link href="/projects/new" className="secondary-button">پروژه جدید</Link>
      </div>
    );
  }

  return (
    <ul className="project-progress">
      {projects.map((project) => (
        <li key={project.id}>
          <Link href={`/projects/${project.id}`} className="pp-row">
            <div className="pp-head">
              <strong>{project.name}</strong>
              <span className="pp-percent">{fa(project.percent)}٪</span>
            </div>
            <div className="progress" role="progressbar" aria-valuenow={project.percent} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${project.percent}%` }} />
            </div>
            <small>
              {project.total
                ? `${fa(project.done)} از ${fa(project.total)} وظیفه انجام شده`
                : "هنوز وظیفه‌ای ثبت نشده"}
              {" · "}
              {PROJECT_STATUS_LABELS[project.status]}
            </small>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------- Weekly bars */
export function WeeklyBars({ week }) {
  const max = Math.max(1, ...week.map((d) => d.count));
  const total = week.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="bars-wrap">
      <div className="bars" role="img" aria-label="وظایف ساخته‌شده در هفت روز اخیر">
        {week.map((d, i) => (
          <div className="bar-col" key={d.key} title={`${d.label}: ${fa(d.count)} وظیفه`}>
            <span className="bar-count">{d.count ? fa(d.count) : ""}</span>
            <span className={`bar ${i === week.length - 1 ? "is-today" : ""}`} style={{ height: `${Math.max(6, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.35 }} />
            <span className="bar-label">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="bars-note">{total ? `${fa(total)} وظیفه در ۷ روز اخیر ساخته شده` : "در ۷ روز اخیر وظیفه‌ای ساخته نشده است"}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- Team */
export function Avatar({ id, firstName, lastName, size = "md" }) {
  return (
    <span className={`avatar avatar-${size}`} style={{ "--h": hueFromString(id) }} title={`${firstName} ${lastName}`}>
      {initials(firstName, lastName)}
    </span>
  );
}

export function TeamCard({ team, memberCount }) {
  const extra = Math.max(0, memberCount - 5);
  return (
    <div className="team">
      <div className="avatar-stack">
        {team.slice(0, 5).map((m) => (
          <Avatar key={m.id} {...m} />
        ))}
        {extra > 0 && <span className="avatar avatar-md avatar-more">+{fa(extra)}</span>}
      </div>
      <ul className="team-list">
        {team.slice(0, 4).map((m) => (
          <li key={m.id}>
            <Avatar {...m} size="sm" />
            <span>{m.firstName} {m.lastName}</span>
            <span className={`chip ${m.role === "owner" ? "chip-owner" : "chip-member"}`}>{m.role === "owner" ? "مالک" : "عضو"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
