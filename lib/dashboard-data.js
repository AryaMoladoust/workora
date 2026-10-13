import mongoose from "mongoose";
import { connectToDatabase } from "./db";
import Project from "../database/models/Project";
import Task from "../database/models/Task";
import Membership from "../database/models/Membership";
import User from "../database/models/User";
import { APP_TIMEZONE, dayKey, relativeTime, weekdayShort } from "./format";
import { canViewAllProjects, projectScope, visibleProjectIds } from "./project-access";
import { getActivities } from "./activity";
import Announcement from "../database/models/Announcement";

const PRIORITY_WEIGHT = { urgent: 0, high: 1, medium: 2, low: 3 };

function toCounts(rows) {
  const out = { todo: 0, in_progress: 0, done: 0 };
  for (const row of rows) if (row._id in out) out[row._id] = row.count;
  return out;
}

function lastSevenDayKeys(now) {
  const keys = [];
  for (let i = 6; i >= 0; i -= 1) keys.push(dayKey(new Date(now.getTime() - i * 86400000)));
  return keys;
}

export async function getDashboardData(current) {
  await connectToDatabase();

  const now = new Date();
  const workspaceId = new mongoose.Types.ObjectId(current.workspace.id);
  const userId = new mongoose.Types.ObjectId(current.user.id);
  const weekStart = new Date(now.getTime() - 8 * 86400000);

  // Members who are not project managers only see data of their own projects.
  const restricted = !canViewAllProjects(current);
  const visibleIds = restricted ? await visibleProjectIds(current) : null;
  const taskScope = restricted ? { workspaceId, projectId: { $in: visibleIds } } : { workspaceId };
  const projectFilter = projectScope(current);
  const projectAggScope = restricted ? { workspaceId, memberIds: userId } : { workspaceId };

  const [
    workspaceStatusRows,
    myStatusRows,
    overdueCount,
    delegatedOpenCount,
    myOpenTasks,
    projectStatusRows,
    recentProjects,
    perProjectRows,
    createdRows,
    memberships,
    memberCount,
    activityData,
    latestAnnouncement,
  ] = await Promise.all([
    Task.aggregate([{ $match: taskScope }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { workspaceId, assigneeId: userId } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Task.countDocuments({ workspaceId, assigneeId: userId, status: { $ne: "done" }, dueAt: { $ne: null, $lt: now } }),
    Task.countDocuments({
      workspaceId,
      createdBy: userId,
      assigneeId: { $nin: [userId, null] },
      status: { $ne: "done" },
    }),
    Task.find({ workspaceId, assigneeId: userId, status: { $in: ["todo", "in_progress"] } })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean(),
    Project.aggregate([{ $match: projectAggScope }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Project.find({ ...projectFilter, status: "active" }).sort({ updatedAt: -1 }).limit(5).lean(),
    Task.aggregate([
      { $match: taskScope },
      { $group: { _id: { projectId: "$projectId", status: "$status" }, count: { $sum: 1 } } },
    ]),
    Task.aggregate([
      { $match: { ...taskScope, createdAt: { $gte: weekStart } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: APP_TIMEZONE } }, count: { $sum: 1 } } },
    ]),
    Membership.find({ workspaceId, isActive: true }).sort({ role: -1, joinedAt: 1 }).limit(8).lean(),
    Membership.countDocuments({ workspaceId, isActive: true }),
    getActivities(current, { limit: 6 }),
    Announcement.findOne({ workspaceId }).sort({ pinned: -1, createdAt: -1 }).lean(),
  ]);

  // ---- workspace-wide task distribution
  const workspaceCounts = toCounts(workspaceStatusRows);
  const workspaceTotal = workspaceCounts.todo + workspaceCounts.in_progress + workspaceCounts.done;

  // ---- my tasks
  const myCounts = toCounts(myStatusRows);
  const myOpen = myCounts.todo + myCounts.in_progress;

  // project names for the task list (only the ones we need)
  const neededProjectIds = [...new Set(myOpenTasks.map((t) => String(t.projectId)))];
  const taskProjects = neededProjectIds.length
    ? await Project.find({ _id: { $in: neededProjectIds }, workspaceId }).select("name").lean()
    : [];
  const projectNameById = new Map(taskProjects.map((p) => [String(p._id), p.name]));

  const upcomingTasks = myOpenTasks
    .map((t) => ({
      id: String(t._id),
      projectId: String(t.projectId),
      projectName: projectNameById.get(String(t.projectId)) || "پروژه",
      title: t.title,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt ? new Date(t.dueAt).toISOString() : null,
    }))
    .sort((a, b) => {
      if (a.dueAt && b.dueAt) return new Date(a.dueAt) - new Date(b.dueAt);
      if (a.dueAt) return -1;
      if (b.dueAt) return 1;
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
    })
    .slice(0, 6);

  // ---- projects
  const projectStatusCounts = { active: 0, completed: 0, archived: 0 };
  for (const row of projectStatusRows) if (row._id in projectStatusCounts) projectStatusCounts[row._id] = row.count;
  const projectTotal = projectStatusCounts.active + projectStatusCounts.completed + projectStatusCounts.archived;

  const perProject = new Map();
  for (const row of perProjectRows) {
    const key = String(row._id.projectId);
    const entry = perProject.get(key) || { todo: 0, in_progress: 0, done: 0 };
    if (row._id.status in entry) entry[row._id.status] = row.count;
    perProject.set(key, entry);
  }
  const projects = recentProjects.map((p) => {
    const c = perProject.get(String(p._id)) || { todo: 0, in_progress: 0, done: 0 };
    const total = c.todo + c.in_progress + c.done;
    return {
      id: String(p._id),
      name: p.name,
      status: p.status,
      total,
      done: c.done,
      percent: total ? Math.round((c.done / total) * 100) : 0,
    };
  });

  // ---- tasks created in the last 7 days
  const createdMap = new Map(createdRows.map((r) => [r._id, r.count]));
  const week = lastSevenDayKeys(now).map((key) => ({
    key,
    label: weekdayShort(key),
    count: createdMap.get(key) || 0,
  }));

  // ---- team
  const userIds = memberships.map((m) => m.userId);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select("firstName lastName").lean()
    : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const team = memberships
    .map((m) => {
      const u = userById.get(String(m.userId));
      if (!u) return null;
      return { id: String(u._id), firstName: u.firstName, lastName: u.lastName, role: m.role };
    })
    .filter(Boolean);

  return {
    now: now.toISOString(),
    me: { open: myOpen, inProgress: myCounts.in_progress, done: myCounts.done, overdue: overdueCount, delegatedOpen: delegatedOpenCount },
    workspace: {
      counts: workspaceCounts,
      total: workspaceTotal,
      percentDone: workspaceTotal ? Math.round((workspaceCounts.done / workspaceTotal) * 100) : 0,
    },
    projectCounts: { ...projectStatusCounts, total: projectTotal },
    projects,
    upcomingTasks,
    week,
    team,
    memberCount,
    activities: activityData.items,
    announcement: latestAnnouncement
      ? { id: String(latestAnnouncement._id), title: latestAnnouncement.title, body: latestAnnouncement.body.slice(0, 220), pinned: Boolean(latestAnnouncement.pinned), relative: relativeTime(latestAnnouncement.createdAt) }
      : null,
  };
}
