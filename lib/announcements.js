import { hasPermission } from "./permissions";
import { relativeTime, dateTime } from "./format";

export function canPostAnnouncements(current) {
  return hasPermission(current, "workspace.manage");
}

export function serializeAnnouncement(a, current) {
  return {
    id: String(a._id),
    title: a.title,
    body: a.body,
    pinned: Boolean(a.pinned),
    authorId: String(a.authorId),
    authorName: a.authorName || "مدیر",
    createdText: dateTime(a.createdAt),
    relative: relativeTime(a.createdAt),
    createdAt: new Date(a.createdAt).toISOString(),
    canEdit: current ? canPostAnnouncements(current) : false,
  };
}
