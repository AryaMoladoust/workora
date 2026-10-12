import Link from "next/link";
import mongoose from "mongoose";
import Icon from "../../components/ui/Icon";
import ProjectCard from "../../components/projects/ProjectCard";
import { requireAuth } from "../../lib/require-auth";
import { connectToDatabase } from "../../lib/db";
import { hasPermission } from "../../lib/permissions";
import { canViewAllProjects, projectScope } from "../../lib/project-access";
import { fa } from "../../lib/format";
import Project from "../../database/models/Project";
import Task from "../../database/models/Task";
import User from "../../database/models/User";

export const dynamic = "force-dynamic";

const FILTERS = [
  ["all", "همه"],
  ["active", "فعال"],
  ["completed", "تکمیل‌شده"],
  ["archived", "بایگانی"],
];

function href(status, q) {
  const params = new URLSearchParams();
  if (status && status !== "all") params.set("status", status);
  if (q) params.set("q", q);
  const qs = params.toString();
  return qs ? `/projects?${qs}` : "/projects";
}

export default async function ProjectsPage({ searchParams }) {
  searchParams = await searchParams;
  const current = await requireAuth();
  const status = FILTERS.some(([id]) => id === searchParams?.status) ? searchParams.status : "all";
  const q = String(searchParams?.q || "").trim().slice(0, 80);

  await connectToDatabase();
  const now = new Date();
  const all = await Project.find(projectScope(current)).sort({ updatedAt: -1 }).limit(300).lean();

  const counts = { all: all.length, active: 0, completed: 0, archived: 0 };
  for (const p of all) counts[p.status] += 1;

  const needle = q.toLowerCase();
  const filtered = all.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (needle && !`${p.name} ${p.description}`.toLowerCase().includes(needle)) return false;
    return true;
  });

  // task stats for the visible projects
  const projectIds = filtered.map((p) => p._id);
  const statRows = projectIds.length
    ? await Task.aggregate([
        { $match: { workspaceId: new mongoose.Types.ObjectId(current.workspace.id), projectId: { $in: projectIds } } },
        {
          $group: {
            _id: "$projectId",
            total: { $sum: 1 },
            done: { $sum: { $cond: [{ $eq: ["$status", "done"] }, 1, 0] } },
            overdue: {
              $sum: {
                $cond: [
                  { $and: [{ $ne: ["$status", "done"] }, { $ne: ["$dueAt", null] }, { $lt: ["$dueAt", now] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ])
    : [];
  const stats = new Map(statRows.map((r) => [String(r._id), r]));

  // members shown on cards
  const shownIds = [...new Set(filtered.flatMap((p) => p.memberIds.slice(0, 4).map(String)))];
  const users = shownIds.length ? await User.find({ _id: { $in: shownIds } }).select("firstName lastName").lean() : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));

  const cards = filtered.map((p) => {
    const s = stats.get(String(p._id)) || { total: 0, done: 0, overdue: 0 };
    return {
      id: String(p._id),
      name: p.name,
      description: p.description,
      status: p.status,
      dueAt: p.dueAt ? new Date(p.dueAt).toISOString() : null,
      total: s.total,
      done: s.done,
      overdue: s.overdue,
      percent: s.total ? Math.round((s.done / s.total) * 100) : 0,
      memberCount: p.memberIds.length,
      members: p.memberIds
        .slice(0, 4)
        .map((id) => userById.get(String(id)))
        .filter(Boolean)
        .map((u) => ({ id: String(u._id), firstName: u.firstName, lastName: u.lastName })),
    };
  });

  const canManage = hasPermission(current, "projects.manage");

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Projects</span>
          <h1>پروژه‌ها</h1>
          <p>
            {canViewAllProjects(current)
              ? `همه پروژه‌های «${current.workspace.name}»`
              : "پروژه‌هایی که عضو آن‌ها هستید"}
          </p>
        </div>
        {canManage && (
          <Link className="primary-button" href="/projects/new">
            <Icon name="plus" size={18} />
            پروژه جدید
          </Link>
        )}
      </div>

      <div className="toolbar">
        <form className="search-field" action="/projects" method="get">
          <Icon name="search" size={18} />
          <input type="search" name="q" defaultValue={q} placeholder="جستجوی نام یا توضیحات پروژه..." />
          {status !== "all" && <input type="hidden" name="status" value={status} />}
        </form>
        <div className="filter-tabs">
          {FILTERS.map(([id, label]) => (
            <Link key={id} href={href(id, q)} className={status === id ? "is-active" : ""}>
              {label}
              <span>{fa(counts[id])}</span>
            </Link>
          ))}
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <h2>{all.length === 0 ? "هنوز پروژه‌ای وجود ندارد" : "پروژه‌ای پیدا نشد"}</h2>
          <p>
            {all.length === 0
              ? canManage
                ? "اولین پروژه را بسازید تا اینجا نمایش داده شود."
                : "وقتی به پروژه‌ای اضافه شوید، اینجا نمایش داده می‌شود."
              : "عبارت جستجو یا فیلتر را تغییر دهید."}
          </p>
          {all.length === 0 && canManage && (
            <Link className="primary-button" href="/projects/new">ایجاد اولین پروژه</Link>
          )}
        </div>
      ) : (
        <div className="project-grid">
          {cards.map((project) => (
            <ProjectCard key={project.id} project={project} now={now.toISOString()} />
          ))}
        </div>
      )}
    </div>
  );
}
