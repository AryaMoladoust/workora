import Link from "next/link";
import mongoose from "mongoose";
import { notFound } from "next/navigation";
import Icon from "../../../components/ui/Icon";
import { Card, CardLink, StatCard, StatusDonut, Avatar } from "../../../components/dashboard/widgets";
import { requireAuth } from "../../../lib/require-auth";
import { connectToDatabase } from "../../../lib/db";
import { getProjectForPage } from "../../../lib/project-access";
import { fa, dueInfo, fullDate, dateTime, STATUS_LABELS, PRIORITY_LABELS } from "../../../lib/format";
import Task from "../../../database/models/Task";
import User from "../../../database/models/User";

export const dynamic = "force-dynamic";

export default async function ProjectOverviewPage({ params }) {
  params = await params;
  const current = await requireAuth();
  const project = await getProjectForPage(current, params.projectId);
  if (!project) notFound();

  await connectToDatabase();
  const now = new Date();
  const workspaceId = new mongoose.Types.ObjectId(current.workspace.id);
  const projectId = project._id;

  const [statusRows, overdue, recentTasks, openByAssignee, users] = await Promise.all([
    Task.aggregate([{ $match: { workspaceId, projectId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Task.countDocuments({ workspaceId, projectId, status: { $ne: "done" }, dueAt: { $ne: null, $lt: now } }),
    Task.find({ workspaceId, projectId }).sort({ createdAt: -1 }).limit(6).lean(),
    Task.aggregate([
      { $match: { workspaceId, projectId, status: { $ne: "done" }, assigneeId: { $ne: null } } },
      { $group: { _id: "$assigneeId", count: { $sum: 1 } } },
    ]),
    User.find({ _id: { $in: [...project.memberIds, project.createdBy] } }).select("firstName lastName").lean(),
  ]);

  const counts = { todo: 0, in_progress: 0, done: 0 };
  for (const r of statusRows) if (r._id in counts) counts[r._id] = r.count;
  const total = counts.todo + counts.in_progress + counts.done;
  const percentDone = total ? Math.round((counts.done / total) * 100) : 0;

  const userById = new Map(users.map((u) => [String(u._id), u]));
  const openMap = new Map(openByAssignee.map((r) => [String(r._id), r.count]));
  const team = project.memberIds
    .map((id) => userById.get(String(id)))
    .filter(Boolean)
    .map((u) => ({ id: String(u._id), firstName: u.firstName, lastName: u.lastName, open: openMap.get(String(u._id)) || 0 }));
  const creator = userById.get(String(project.createdBy));
  const due = project.dueAt ? dueInfo(project.dueAt, now) : null;
  const base = `/projects/${project._id}`;

  return (
    <div className="dashboard">
      <section className="stat-grid">
        <StatCard icon="layers" label="کل وظایف" value={total} hint={`${fa(percentDone)}٪ انجام شده`} />
        <StatCard icon="trend" label="در حال انجام" value={counts.in_progress} tone="info" hint="وظایف در جریان" />
        <StatCard icon="check" label="انجام شده" value={counts.done} tone="ok" hint={`${fa(counts.todo)} مورد مانده`} />
        <StatCard icon="alert" label="عقب‌افتاده" value={overdue} tone={overdue ? "danger" : "ok"} hint={overdue ? "نیازمند توجه" : "همه‌چیز طبق برنامه"} />
      </section>

      <section className="dash-grid">
        <Card className="span-7" title="آخرین وظایف" icon="tasks" action={<CardLink href={`${base}/tasks`}>همه وظایف</CardLink>}>
          {recentTasks.length === 0 ? (
            <div className="empty-inline">
              <span className="empty-inline-icon"><Icon name="tasks" size={22} /></span>
              <strong>هنوز وظیفه‌ای ثبت نشده</strong>
              <p>از تب «وظایف» اولین وظیفه این پروژه را بسازید.</p>
              <Link href={`${base}/tasks`} className="secondary-button">رفتن به وظایف</Link>
            </div>
          ) : (
            <ul className="task-rows">
              {recentTasks.map((task) => (
                <li key={String(task._id)}>
                  <Link href={`${base}/tasks?task=${task._id}`} className="task-row">
                    <span className={`prio-dot prio-${task.priority}`} title={`اولویت ${PRIORITY_LABELS[task.priority]}`} />
                    <span className="task-row-main">
                      <strong>{task.title}</strong>
                      <small>{dateTime(task.createdAt)}</small>
                    </span>
                    <span className={`chip chip-${task.status}`}>{STATUS_LABELS[task.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="span-5" title="وضعیت وظایف" icon="layers">
          <StatusDonut counts={counts} total={total} percentDone={percentDone} />
        </Card>

        <Card className="span-5" title="اطلاعات پروژه" icon="folder">
          <dl className="info-list">
            <div><dt>سازنده</dt><dd>{creator ? `${creator.firstName} ${creator.lastName}` : "—"}</dd></div>
            <div><dt>تاریخ ایجاد</dt><dd>{fullDate(project.createdAt)}</dd></div>
            <div><dt>تاریخ شروع</dt><dd>{project.startAt ? fullDate(project.startAt) : "ثبت نشده"}</dd></div>
            <div>
              <dt>مهلت</dt>
              <dd>
                {project.dueAt ? fullDate(project.dueAt) : "ثبت نشده"}
                {due && project.status === "active" && <span className={`due due-${due.tone}`}>{due.text}</span>}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="span-7" title="اعضای پروژه" icon="users" action={<CardLink href={`${base}/members`}>مدیریت اعضا</CardLink>}>
          <ul className="team-list team-list-wide">
            {team.map((m) => (
              <li key={m.id}>
                <Avatar {...m} size="sm" />
                <span>{m.firstName} {m.lastName}</span>
                <span className="chip">{m.open ? `${fa(m.open)} وظیفه باز` : "بدون وظیفه باز"}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
