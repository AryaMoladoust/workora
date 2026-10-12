import mongoose from "mongoose";
import { connectToDatabase } from "./db";
import { describeNotification, linkFor } from "./activity-text";
import { relativeTime } from "./format";
import Notification from "../database/models/Notification";

export async function unreadCountFor(current) {
  await connectToDatabase();
  return Notification.countDocuments({ workspaceId: current.workspace.id, userId: current.user.id, readAt: null });
}

export function serializeNotification(n, now = new Date()) {
  const item = {
    id: String(n._id),
    type: n.type,
    entityType: n.entityType,
    entityId: n.entityId ? String(n.entityId) : null,
    entityTitle: n.entityTitle || "",
    actorId: String(n.actorId),
    actorName: n.actorName || "کاربر",
    projectId: n.projectId ? String(n.projectId) : null,
    projectName: n.projectName || "",
    meta: n.meta || {},
    read: Boolean(n.readAt),
    relative: relativeTime(n.createdAt, now),
  };
  item.text = describeNotification(item);
  item.link = linkFor({ ...item, type: n.type === "project.member_added" ? "project.created" : n.type });
  return item;
}

export async function listNotifications(current, { unreadOnly = false, limit = 20, skip = 0 } = {}) {
  await connectToDatabase();
  const filter = { workspaceId: current.workspace.id, userId: current.user.id };
  if (unreadOnly) filter.readAt = null;
  const [rows, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    unreadCountFor(current),
  ]);
  const now = new Date();
  return { items: rows.map((r) => serializeNotification(r, now)), total, unread };
}

export async function markNotificationsRead(current, { ids, all }) {
  await connectToDatabase();
  const filter = { workspaceId: current.workspace.id, userId: current.user.id, readAt: null };
  if (!all) {
    const valid = (Array.isArray(ids) ? ids : []).filter((id) => mongoose.isValidObjectId(id));
    if (!valid.length) return 0;
    filter._id = { $in: valid };
  }
  const result = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return result.modifiedCount || 0;
}
