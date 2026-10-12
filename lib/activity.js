import mongoose from "mongoose";
import { connectToDatabase } from "./db";
import { hasPermission } from "./permissions";
import { canViewAllProjects, visibleProjectIds } from "./project-access";
import { filterActiveMemberIds } from "./members";
import { publish } from "./realtime";
import { TYPE_GROUPS, linkFor } from "./activity-text";
import { dayKey, relativeTime, timeOnly } from "./format";
import Activity from "../database/models/Activity";
import Notification from "../database/models/Notification";
import User from "../database/models/User";

export function actorNameOf(current) {
  return `${current.user.firstName} ${current.user.lastName}`.trim();
}

export async function userNameMap(ids) {
  const valid = [...new Set(ids.filter(Boolean).map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (!valid.length) return new Map();
  await connectToDatabase();
  const users = await User.find({ _id: { $in: valid } }).select("firstName lastName").lean();
  return new Map(users.map((u) => [String(u._id), `${u.firstName} ${u.lastName}`.trim()]));
}

function projectRef(project) {
  if (!project) return { projectId: null, projectName: "" };
  return { projectId: project._id || project.id || null, projectName: project.name || "" };
}

// Best effort: a logging failure must never break the real action.
export async function logActivity(current, { type, entityType, entityId = null, entityTitle = "", project = null, meta = {} }) {
  try {
    await connectToDatabase();
    await Activity.create({
      workspaceId: current.workspace.id,
      ...projectRef(project),
      actorId: current.user.id,
      actorName: actorNameOf(current),
      type,
      entityType,
      entityId,
      entityTitle: String(entityTitle || "").slice(0, 240),
      meta,
    });
  } catch (error) {
    console.error("ACTIVITY_LOG_ERROR", error);
  }
}

// Creates one notification per recipient (never for the actor, only for active members).
export async function notify(current, recipientIds, { type, entityType, entityId = null, entityTitle = "", project = null, meta = {} }) {
  try {
    const ids = [...new Set((recipientIds || []).filter(Boolean).map(String))].filter((id) => id !== current.user.id);
    if (!ids.length) return;
    const active = await filterActiveMemberIds(current.workspace.id, ids);
    if (!active.length) return;
    await Notification.insertMany(
      active.map((userId) => ({
        workspaceId: current.workspace.id,
        userId,
        actorId: current.user.id,
        actorName: actorNameOf(current),
        ...projectRef(project),
        type,
        entityType,
        entityId,
        entityTitle: String(entityTitle || "").slice(0, 240),
        meta,
      }))
    );
    publish(active, { type: "notification" });
  } catch (error) {
    console.error("NOTIFY_ERROR", error);
  }
}

export function serializeActivity(a, now = new Date()) {
  const item = {
    id: String(a._id),
    type: a.type,
    entityType: a.entityType,
    entityId: a.entityId ? String(a.entityId) : null,
    entityTitle: a.entityTitle || "",
    actorId: String(a.actorId),
    actorName: a.actorName || "کاربر",
    projectId: a.projectId ? String(a.projectId) : null,
    projectName: a.projectName || "",
    meta: a.meta || {},
    dayKey: dayKey(a.createdAt),
    timeText: timeOnly(a.createdAt),
    relative: relativeTime(a.createdAt, now),
  };
  item.link = linkFor(item);
  return item;
}

const RANGES = { "24h": 86400000, "7d": 7 * 86400000, "30d": 30 * 86400000 };

// Activities the signed-in user is allowed to see, newest first.
export async function getActivities(current, { projectId = null, actorId = null, group = "", range = "", page = 1, limit = 30 } = {}) {
  await connectToDatabase();
  const now = new Date();
  const filter = { workspaceId: current.workspace.id };

  if (!canViewAllProjects(current)) {
    const ids = await visibleProjectIds(current);
    const or = [{ projectId: { $in: ids } }];
    if (hasPermission(current, "members.manage")) or.push({ entityType: "member" });
    filter.$or = or;
  }

  if (projectId && mongoose.isValidObjectId(projectId)) filter.projectId = projectId;
  if (actorId && mongoose.isValidObjectId(actorId)) filter.actorId = actorId;
  if (group && TYPE_GROUPS[group]) filter.type = { $in: TYPE_GROUPS[group] };
  if (range && RANGES[range]) filter.createdAt = { $gte: new Date(now.getTime() - RANGES[range]) };

  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const [rows, total] = await Promise.all([
    Activity.find(filter).sort({ createdAt: -1 }).skip((safePage - 1) * limit).limit(limit).lean(),
    Activity.countDocuments(filter),
  ]);

  return {
    items: rows.map((r) => serializeActivity(r, now)),
    total,
    page: safePage,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}
