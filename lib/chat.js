import mongoose from "mongoose";
import { connectToDatabase } from "./db";
import { findAccessibleProject } from "./project-access";
import { filterActiveMemberIds } from "./members";
import { userNameMap, notify } from "./activity";
import { publish } from "./realtime";
import { schedulePush, pushForChatMessage } from "./push";
import { dayKey, lastSeenText, listTime, timeOnly } from "./format";
import Conversation from "../database/models/Conversation";
import ChatMessage from "../database/models/ChatMessage";
import ConversationRead from "../database/models/ConversationRead";
import Project from "../database/models/Project";
import User from "../database/models/User";

export const MESSAGE_LIMIT = 4000;
export const MAX_PINS = 20;
export const ONLINE_WINDOW_MS = 2 * 60 * 1000; // heartbeat every ~60s → online when seen in the last 2 minutes
// Quick reactions offered in the UI (the API accepts only these).
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉"];

export function directKeyFor(a, b) {
  return [String(a), String(b)].sort().join(":");
}

const isMember = (project, userId) => (project.memberIds || []).map(String).includes(String(userId));

function clip(text, max) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/* ---------------------------------------------------------------- serialization */
// names: Map(userId → "First Last") used for the author, the reply quote and the mentions.
export function serializeMessage(message, names = new Map()) {
  const deleted = Boolean(message.deletedAt);
  const nameOf = (id) => names.get(String(id)) || "کاربر حذف‌شده";
  const out = {
    id: String(message._id),
    conversationId: String(message.conversationId),
    authorId: String(message.authorId),
    authorName: nameOf(message.authorId),
    body: deleted ? "" : message.body,
    deleted,
    createdAt: new Date(message.createdAt).toISOString(),
    dayKey: dayKey(message.createdAt),
    timeText: timeOnly(message.createdAt),
    edited: Boolean(message.editedAt) && !deleted,
    pinned: Boolean(message.pinnedAt) && !deleted,
    pinnedAt: message.pinnedAt && !deleted ? new Date(message.pinnedAt).toISOString() : null,
    reactions: deleted ? [] : (message.reactions || []).filter((r) => r.userIds?.length).map((r) => ({ emoji: r.emoji, userIds: r.userIds.map(String) })),
    mentions: deleted ? [] : (message.mentions || []).map((id) => ({ id: String(id), name: nameOf(id) })),
    replyTo: null,
  };
  if (!deleted && message.replyTo?.messageId) {
    out.replyTo = {
      id: String(message.replyTo.messageId),
      authorId: message.replyTo.authorId ? String(message.replyTo.authorId) : null,
      authorName: message.replyTo.authorName || "کاربر",
      preview: message.replyTo.preview || "",
    };
  }
  return out;
}

export async function serializeMessages(messages) {
  const ids = [];
  for (const m of messages) {
    ids.push(m.authorId);
    for (const id of m.mentions || []) ids.push(id);
  }
  const names = await userNameMap(ids);
  return messages.map((m) => serializeMessage(m, names));
}

export async function serializeOne(message) {
  return (await serializeMessages([message]))[0];
}

/* ---------------------------------------------------------------- access */
// Returns { conversation, participants:[userId], project? } or null when the user may not use it.
export async function conversationAccess(current, conversationId) {
  if (!mongoose.isValidObjectId(conversationId)) return null;
  await connectToDatabase();
  const conversation = await Conversation.findOne({ _id: conversationId, workspaceId: current.workspace.id }).lean();
  if (!conversation) return null;

  if (conversation.type === "direct") {
    const participants = (conversation.participantIds || []).map(String);
    if (!participants.includes(current.user.id)) return null;
    return { conversation, participants };
  }

  const project = await findAccessibleProject(current, conversation.projectId);
  if (!project || !isMember(project, current.user.id)) return null;
  return { conversation, project, participants: (project.memberIds || []).map(String) };
}

// Pushes an event to the active participants of a conversation.
export async function publishToParticipants(current, participants, event) {
  const active = await filterActiveMemberIds(current.workspace.id, participants);
  publish(active, event);
}

// Device (push) notification for a new chat message – everyone except the sender, only active members.
// Muted conversations stay silent; people who were @mentioned get their own (mention) notification instead.
export async function pushChatMessage(current, access, text, { skipIds = [] } = {}) {
  try {
    const skip = new Set(skipIds.map(String));
    const recipients = access.participants.filter((id) => id !== current.user.id && !skip.has(id));
    const active = await filterActiveMemberIds(current.workspace.id, recipients);
    if (!active.length) return;
    const muted = await mutedUserIds(access.conversation._id, active);
    const audible = active.filter((id) => !muted.has(id));
    if (!audible.length) return;
    schedulePush(
      audible,
      pushForChatMessage({
        senderName: `${current.user.firstName} ${current.user.lastName}`.trim(),
        projectName: access.project?.name,
        conversationId: String(access.conversation._id),
        text,
        kind: access.conversation.type,
      }),
      { urgency: "high", ttl: 600 }
    );
  } catch (error) {
    console.error("CHAT_PUSH_ERROR", error);
  }
}

// Notification (bell + device push) for people mentioned with @name in a group chat. Works even when muted.
export async function notifyMentions(current, access, mentionedIds, text) {
  if (!mentionedIds.length) return;
  await notify(current, mentionedIds, {
    type: "chat.mention",
    entityType: "chat",
    entityId: access.conversation._id,
    entityTitle: clip(text, 100),
    project: access.project || null,
    meta: { conversationId: String(access.conversation._id) },
  });
}

/* ---------------------------------------------------------------- participants, presence, reads, mute */
export async function participantList(current, access) {
  const active = await filterActiveMemberIds(current.workspace.id, access.participants);
  const names = await userNameMap(active);
  return active.map((id) => ({ id, name: names.get(id) || "کاربر" }));
}

export function isOnline(lastSeenAt, now = Date.now()) {
  return Boolean(lastSeenAt) && now - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

export function presenceOf(user, now = new Date()) {
  const online = isOnline(user?.lastSeenAt, now.getTime());
  return {
    online,
    lastSeenAt: user?.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null,
    lastSeenText: !online && user?.lastSeenAt ? lastSeenText(user.lastSeenAt, now) : "",
  };
}

// Records "I am here" (called by the app heartbeat). Writes at most every 30 seconds per user.
export async function touchPresence(userId) {
  await connectToDatabase();
  const now = new Date();
  await User.updateOne(
    { _id: userId, $or: [{ lastSeenAt: null }, { lastSeenAt: { $lt: new Date(now.getTime() - 30000) } }] },
    { $set: { lastSeenAt: now } }
  );
}

// { userId: ISO date } of when the OTHER participants last read the conversation (drives the double tick).
export async function readsOf(conversationId, exceptUserId) {
  const rows = await ConversationRead.find({ conversationId, userId: { $ne: exceptUserId } }).select("userId lastReadAt").lean();
  const out = {};
  for (const r of rows) out[String(r.userId)] = new Date(r.lastReadAt).toISOString();
  return out;
}

export async function mutedUserIds(conversationId, userIds) {
  const rows = await ConversationRead.find({ conversationId, userId: { $in: userIds }, muted: true }).select("userId").lean();
  return new Set(rows.map((r) => String(r.userId)));
}

export async function isMutedFor(conversationId, userId) {
  return Boolean(await ConversationRead.exists({ conversationId, userId, muted: true }));
}

export async function setMuted(current, conversationId, muted) {
  await connectToDatabase();
  await ConversationRead.updateOne(
    { conversationId, userId: current.user.id },
    { $set: { muted: Boolean(muted) }, $setOnInsert: { lastReadAt: new Date(0) } },
    { upsert: true }
  );
  return Boolean(muted);
}

/* ---------------------------------------------------------------- message helpers */
// Only ids that really take part in the conversation AND whose "@name" is still in the text count as mentions.
export async function resolveMentions(current, access, body, requestedIds) {
  if (access.conversation.type !== "project" || !Array.isArray(requestedIds) || !requestedIds.length) return [];
  const people = await participantList(current, access);
  const byId = new Map(people.map((p) => [p.id, p]));
  const out = [];
  for (const id of new Set(requestedIds.map(String))) {
    const person = byId.get(id);
    if (!person || id === current.user.id) continue;
    if (body.includes(`@${person.name}`)) out.push(id);
  }
  return out.slice(0, 20);
}

export async function replySnapshot(access, replyToId) {
  if (!replyToId || !mongoose.isValidObjectId(replyToId)) return null;
  const original = await ChatMessage.findOne({ _id: replyToId, conversationId: access.conversation._id, deletedAt: null }).lean();
  if (!original) return null;
  const names = await userNameMap([original.authorId]);
  return {
    messageId: original._id,
    authorId: original.authorId,
    authorName: names.get(String(original.authorId)) || "کاربر",
    preview: clip(original.body, 120),
  };
}

export async function pinsOf(conversationId) {
  const rows = await ChatMessage.find({ conversationId, pinnedAt: { $ne: null }, deletedAt: null }).sort({ pinnedAt: -1 }).limit(MAX_PINS).lean();
  return serializeMessages(rows);
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchMessages(conversationId, query, limit = 30) {
  const q = String(query || "").trim().slice(0, 100);
  if (q.length < 2) return [];
  const rows = await ChatMessage.find({ conversationId, deletedAt: null, body: { $regex: escapeRegex(q), $options: "i" } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return serializeMessages(rows);
}

// A window of messages around one message (used to jump to a search result or a quoted message).
export async function messagesAround(conversationId, messageId, before = 25, after = 25) {
  const target = await ChatMessage.findOne({ _id: messageId, conversationId }).lean();
  if (!target) return null;
  const [older, newer] = await Promise.all([
    ChatMessage.find({ conversationId, createdAt: { $lte: target.createdAt }, _id: { $ne: target._id } }).sort({ createdAt: -1 }).limit(before + 1).lean(),
    ChatMessage.find({ conversationId, createdAt: { $gt: target.createdAt } }).sort({ createdAt: 1 }).limit(after + 1).lean(),
  ]);
  const hasMoreOlder = older.length > before;
  const hasNewer = newer.length > after;
  const rows = [...older.slice(0, before).reverse(), target, ...newer.slice(0, after)];
  return { messages: await serializeMessages(rows), hasMore: hasMoreOlder, hasNewer };
}

/* ---------------------------------------------------------------- open / create */
export async function openProjectConversation(current, projectId) {
  const project = await findAccessibleProject(current, projectId);
  if (!project) return { error: "پروژه پیدا نشد.", status: 404 };
  if (!isMember(project, current.user.id)) {
    return { error: "برای استفاده از چت باید عضو پروژه باشید.", status: 403 };
  }
  const filter = { workspaceId: current.workspace.id, type: "project", projectId: project._id };
  let conversation;
  try {
    conversation = await Conversation.findOneAndUpdate(filter, { $setOnInsert: { lastMessageAt: null } }, { upsert: true, new: true }).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    conversation = await Conversation.findOne(filter).lean();
  }
  return { conversation, project };
}

export async function openDirectConversation(current, otherUserId) {
  if (!mongoose.isValidObjectId(otherUserId) || String(otherUserId) === current.user.id) {
    return { error: "کاربر نامعتبر است.", status: 400 };
  }
  const active = await filterActiveMemberIds(current.workspace.id, [otherUserId]);
  if (!active.length) return { error: "این کاربر عضو فعال فضای کاری نیست.", status: 404 };

  const directKey = directKeyFor(current.user.id, otherUserId);
  const filter = { workspaceId: current.workspace.id, type: "direct", directKey };
  let conversation;
  try {
    conversation = await Conversation.findOneAndUpdate(
      filter,
      { $setOnInsert: { participantIds: [current.user.id, otherUserId], lastMessageAt: null } },
      { upsert: true, new: true }
    ).lean();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    conversation = await Conversation.findOne(filter).lean();
  }
  return { conversation };
}

/* ---------------------------------------------------------------- unread */
async function myConversationDocs(current) {
  const me = current.user.id;
  const projects = await Project.find({ workspaceId: current.workspace.id, memberIds: me }).select("_id name status").lean();
  const conversations = await Conversation.find({
    workspaceId: current.workspace.id,
    $or: [{ type: "direct", participantIds: me }, { type: "project", projectId: { $in: projects.map((p) => p._id) } }],
  }).lean();
  return { projects, conversations };
}

async function unreadMapFor(current, conversations) {
  const me = current.user.id;
  const reads = await ConversationRead.find({ userId: me, conversationId: { $in: conversations.map((c) => c._id) } }).lean();
  const readAt = new Map(reads.map((r) => [String(r.conversationId), r.lastReadAt]));
  const muted = new Set(reads.filter((r) => r.muted).map((r) => String(r.conversationId)));
  const candidates = conversations.filter((c) => c.lastMessageAt);

  const entries = await Promise.all(
    candidates.map(async (c) => {
      const last = readAt.get(String(c._id));
      if (last && new Date(c.lastMessageAt) <= new Date(last)) return [String(c._id), 0];
      const count = await ChatMessage.countDocuments({
        conversationId: c._id,
        authorId: { $ne: me },
        deletedAt: null,
        createdAt: { $gt: last || new Date(0) },
      });
      return [String(c._id), count];
    })
  );
  return { counts: new Map(entries), muted };
}

// Total for the sidebar badge: muted conversations are not counted.
export async function chatUnreadTotal(current) {
  await connectToDatabase();
  const { conversations } = await myConversationDocs(current);
  const { counts, muted } = await unreadMapFor(current, conversations);
  let total = 0;
  for (const [id, v] of counts) if (!muted.has(id)) total += v;
  return total;
}

/* ---------------------------------------------------------------- list */
function entryBase(conversation, me, unread, now, muted = false) {
  return {
    id: String(conversation._id),
    lastPreview: conversation.lastMessagePreview || "",
    lastMine: conversation.lastMessageAuthorId ? String(conversation.lastMessageAuthorId) === me : false,
    lastAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toISOString() : null,
    lastRelative: conversation.lastMessageAt ? listTime(conversation.lastMessageAt, now) : "",
    unread: unread || 0,
    muted: Boolean(muted),
  };
}

export async function listConversations(current) {
  await connectToDatabase();
  const me = current.user.id;
  const now = new Date();

  // make sure every project I belong to has its room
  const { projects } = await myConversationDocs(current);
  const visibleProjects = projects.filter((p) => p.status !== "archived");
  if (visibleProjects.length) {
    await Conversation.bulkWrite(
      visibleProjects.map((p) => ({
        updateOne: {
          filter: { workspaceId: new mongoose.Types.ObjectId(current.workspace.id), type: "project", projectId: p._id },
          update: { $setOnInsert: { lastMessageAt: null } },
          upsert: true,
        },
      })),
      { ordered: false }
    ).catch((error) => {
      if (error?.code !== 11000) throw error;
    });
  }

  const { conversations } = await myConversationDocs(current);
  const { counts: unread, muted } = await unreadMapFor(current, conversations);

  const projectById = new Map(visibleProjects.map((p) => [String(p._id), p]));
  const projectEntries = conversations
    .filter((c) => c.type === "project" && projectById.has(String(c.projectId)))
    .map((c) => ({
      ...entryBase(c, me, unread.get(String(c._id)), now, muted.has(String(c._id))),
      kind: "project",
      title: projectById.get(String(c.projectId)).name,
      projectId: String(c.projectId),
    }));

  const directDocs = conversations.filter((c) => c.type === "direct");
  const otherIds = directDocs.map((c) => (c.participantIds || []).map(String).find((id) => id !== me)).filter(Boolean);
  const users = otherIds.length ? await User.find({ _id: { $in: otherIds } }).select("firstName lastName lastSeenAt").lean() : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const directEntries = directDocs
    .map((c) => {
      const otherId = (c.participantIds || []).map(String).find((id) => id !== me);
      const other = userById.get(otherId);
      if (!other) return null;
      return {
        ...entryBase(c, me, unread.get(String(c._id)), now, muted.has(String(c._id))),
        kind: "direct",
        title: `${other.firstName} ${other.lastName}`,
        userId: otherId,
        online: isOnline(other.lastSeenAt, now.getTime()),
      };
    })
    .filter(Boolean);

  const byRecent = (a, b) => (b.lastAt || "").localeCompare(a.lastAt || "");
  projectEntries.sort((a, b) => byRecent(a, b) || a.title.localeCompare(b.title, "fa"));
  directEntries.sort(byRecent);
  return { projects: projectEntries, directs: directEntries };
}

// Single entry (used after opening a conversation).
export async function entryForConversation(current, conversation, project) {
  const me = current.user.id;
  const now = new Date();
  const { counts, muted } = await unreadMapFor(current, [conversation]);
  const unread = counts.get(String(conversation._id)) || 0;
  const isMuted = muted.has(String(conversation._id));
  if (conversation.type === "project") {
    return { ...entryBase(conversation, me, unread, now, isMuted), kind: "project", title: project.name, projectId: String(project._id) };
  }
  const otherId = (conversation.participantIds || []).map(String).find((id) => id !== me);
  const other = await User.findById(otherId).select("firstName lastName lastSeenAt").lean();
  return {
    ...entryBase(conversation, me, unread, now, isMuted),
    kind: "direct",
    title: other ? `${other.firstName} ${other.lastName}` : "کاربر",
    userId: otherId,
    online: isOnline(other?.lastSeenAt, now.getTime()),
  };
}

export async function markConversationRead(current, conversationId) {
  await connectToDatabase();
  await ConversationRead.updateOne(
    { conversationId, userId: current.user.id },
    { $set: { lastReadAt: new Date() } },
    { upsert: true }
  );
  return chatUnreadTotal(current);
}
