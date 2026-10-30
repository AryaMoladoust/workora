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

// Messages a user chose to delete "for me" never reach that user again.
export const visibleTo = (userId) => ({ hiddenFor: { $ne: new mongoose.Types.ObjectId(String(userId)) } });

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

  if (conversation.type === "direct" || conversation.type === "group") {
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
        projectName: access.project?.name || access.conversation.name,
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
  const users = active.length ? await User.find({ _id: { $in: active } }).select("firstName lastName avatarUrl").lean() : [];
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return active.map((id) => {
    const u = byId.get(id);
    return { id, name: u ? `${u.firstName} ${u.lastName}`.trim() : "کاربر", avatarUrl: u?.avatarUrl || null };
  });
}

export function isOnline(lastSeenAt, now = Date.now()) {
  return Boolean(lastSeenAt) && now - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

export function presenceOf(user, now = new Date()) {
  // people who hide their last seen show neither the green dot nor "last seen ..." to anybody
  if (user?.hideLastSeen) return { online: false, lastSeenAt: null, lastSeenText: "", hidden: true };
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
  if (access.conversation.type === "direct" || !Array.isArray(requestedIds) || !requestedIds.length) return [];
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

export async function pinsOf(conversationId, userId) {
  const rows = await ChatMessage.find({ conversationId, pinnedAt: { $ne: null }, deletedAt: null, ...visibleTo(userId) }).sort({ pinnedAt: -1 }).limit(MAX_PINS).lean();
  return serializeMessages(rows);
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchMessages(conversationId, query, userId, limit = 30) {
  const q = String(query || "").trim().slice(0, 100);
  if (q.length < 2) return [];
  const rows = await ChatMessage.find({ conversationId, deletedAt: null, ...visibleTo(userId), body: { $regex: escapeRegex(q), $options: "i" } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return serializeMessages(rows);
}

// A window of messages around one message (used to jump to a search result or a quoted message).
export async function messagesAround(conversationId, messageId, userId, before = 25, after = 25) {
  const hide = { ...visibleTo(userId), deletedAt: null };
  const target = await ChatMessage.findOne({ _id: messageId, conversationId, ...hide }).lean();
  if (!target) return null;
  const [older, newer] = await Promise.all([
    ChatMessage.find({ conversationId, createdAt: { $lte: target.createdAt }, _id: { $ne: target._id }, ...hide }).sort({ createdAt: -1 }).limit(before + 1).lean(),
    ChatMessage.find({ conversationId, createdAt: { $gt: target.createdAt }, ...hide }).sort({ createdAt: 1 }).limit(after + 1).lean(),
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
  // re-opening a chat I deleted brings it back (empty: the old messages stay hidden for me)
  await ConversationRead.updateOne({ conversationId: conversation._id, userId: current.user.id, hidden: true }, { $set: { hidden: false } });
  return { conversation };
}

/* ---------------------------------------------------------------- unread */
async function myConversationDocs(current) {
  const me = current.user.id;
  const projects = await Project.find({ workspaceId: current.workspace.id, memberIds: me }).select("_id name status").lean();
  const conversations = await Conversation.find({
    workspaceId: current.workspace.id,
    $or: [{ type: { $in: ["direct", "group"] }, participantIds: me }, { type: "project", projectId: { $in: projects.map((p) => p._id) } }],
  }).lean();
  return { projects, conversations };
}

async function unreadMapFor(current, conversations) {
  const me = current.user.id;
  const meId = new mongoose.Types.ObjectId(String(me));
  const reads = await ConversationRead.find({ userId: me, conversationId: { $in: conversations.map((c) => c._id) } }).lean();
  const readAt = new Map(reads.map((r) => [String(r.conversationId), r.lastReadAt]));
  const muted = new Set(reads.filter((r) => r.muted).map((r) => String(r.conversationId)));

  // Only conversations whose last message is newer than my last read can have unread messages.
  const pending = conversations.filter((c) => {
    if (!c.lastMessageAt) return false;
    const last = readAt.get(String(c._id));
    return !last || new Date(c.lastMessageAt) > new Date(last);
  });

  // ONE aggregation for all of them (this runs on every page for the sidebar badge, so it must not scale
  // with the number of conversations). The $or has one branch per pending conversation and each branch
  // uses the { conversationId, createdAt } index.
  const counts = new Map(conversations.filter((c) => c.lastMessageAt).map((c) => [String(c._id), 0]));
  if (pending.length) {
    const rows = await ChatMessage.aggregate([
      {
        $match: {
          authorId: { $ne: meId },
          deletedAt: null,
          ...visibleTo(me),
          $or: pending.map((c) => ({ conversationId: c._id, createdAt: { $gt: readAt.get(String(c._id)) || new Date(0) } })),
        },
      },
      { $group: { _id: "$conversationId", count: { $sum: 1 } } },
    ]);
    for (const row of rows) counts.set(String(row._id), row.count);
  }
  return { counts, muted };
}

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

  const hiddenRows = await ConversationRead.find({ userId: me, hidden: true }).select("conversationId").lean();
  const hiddenIds = new Set(hiddenRows.map((r) => String(r.conversationId)));
  const directDocs = conversations.filter((c) => c.type === "direct" && !hiddenIds.has(String(c._id)));
  const otherIds = directDocs.map((c) => (c.participantIds || []).map(String).find((id) => id !== me)).filter(Boolean);
  const users = otherIds.length ? await User.find({ _id: { $in: otherIds } }).select("firstName lastName lastSeenAt hideLastSeen avatarUrl").lean() : [];
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
        avatarUrl: other.avatarUrl || null,
        online: !other.hideLastSeen && isOnline(other.lastSeenAt, now.getTime()),
      };
    })
    .filter(Boolean);

  const groupEntries = conversations
    .filter((c) => c.type === "group")
    .map((c) => ({
      ...entryBase(c, me, unread.get(String(c._id)), now, muted.has(String(c._id))),
      kind: "group",
      title: c.name || "گروه",
      memberCount: (c.participantIds || []).length,
      isCreator: String(c.createdBy) === me,
    }));

  const byRecent = (a, b) => (b.lastAt || "").localeCompare(a.lastAt || "");
  groupEntries.sort(byRecent);
  projectEntries.sort((a, b) => byRecent(a, b) || a.title.localeCompare(b.title, "fa"));
  directEntries.sort(byRecent);
  return { projects: projectEntries, groups: groupEntries, directs: directEntries };
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
  if (conversation.type === "group") {
    return {
      ...entryBase(conversation, me, unread, now, isMuted),
      kind: "group",
      title: conversation.name || "گروه",
      memberCount: (conversation.participantIds || []).length,
      isCreator: String(conversation.createdBy) === me,
      ownerId: conversation.createdBy ? String(conversation.createdBy) : null,
    };
  }
  const otherId = (conversation.participantIds || []).map(String).find((id) => id !== me);
  const other = await User.findById(otherId).select("firstName lastName lastSeenAt hideLastSeen avatarUrl").lean();
  return {
    ...entryBase(conversation, me, unread, now, isMuted),
    kind: "direct",
    title: other ? `${other.firstName} ${other.lastName}` : "کاربر",
    userId: otherId,
    avatarUrl: other?.avatarUrl || null,
    online: !other?.hideLastSeen && isOnline(other?.lastSeenAt, now.getTime()),
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

/* ---------------------------------------------------------------- custom groups */
export const GROUP_MAX_MEMBERS = 100;

// Body: name + memberIds (workspace members other than me). The creator is always a member.
export async function createGroupConversation(current, name, memberIds) {
  const title = cleanGroupName(name);
  if (!title) return { error: "نام گروه باید بین ۲ تا ۸۰ کاراکتر باشد.", status: 400 };
  const requested = [...new Set((Array.isArray(memberIds) ? memberIds : []).map(String).filter((id) => mongoose.isValidObjectId(id) && id !== current.user.id))];
  if (!requested.length) return { error: "حداقل یک عضو برای گروه انتخاب کنید.", status: 400 };
  if (requested.length + 1 > GROUP_MAX_MEMBERS) return { error: `گروه حداکثر ${GROUP_MAX_MEMBERS} عضو می‌تواند داشته باشد.`, status: 400 };
  await connectToDatabase();
  const active = await filterActiveMemberIds(current.workspace.id, requested);
  if (!active.length) return { error: "اعضای انتخاب‌شده عضو فعال فضای کاری نیستند.", status: 400 };
  const conversation = await Conversation.create({
    workspaceId: current.workspace.id,
    type: "group",
    name: title,
    createdBy: current.user.id,
    participantIds: [current.user.id, ...active],
    lastMessageAt: null,
  });
  return { conversation: conversation.toObject() };
}

// A member leaves a custom group (the group disappears once nobody is left).
export const GROUP_MIN_MEMBERS = 2;

export function cleanGroupName(name) {
  const title = String(name || "").trim().replace(/\s+/g, " ");
  return title.length < 2 || title.length > 80 ? null : title;
}

async function purgeConversation(conversationId) {
  await ChatMessage.deleteMany({ conversationId });
  await ConversationRead.deleteMany({ conversationId });
  await Conversation.deleteOne({ _id: conversationId });
}

/**
 * Keeps a group healthy after people left, were removed or lost their access:
 *  - only ACTIVE members of the workspace stay in it;
 *  - when the manager is gone, the longest-standing remaining member becomes the manager (a group is never ownerless);
 *  - fewer than GROUP_MIN_MEMBERS people left → the group is deleted with its messages.
 * Returns { deleted, ownerId, participants, previous } (ids as strings). Safe to call at any time.
 */
export async function settleGroup(conversationId) {
  await connectToDatabase();
  const conv = await Conversation.findOne({ _id: conversationId, type: "group" }).lean();
  if (!conv) return { missing: true, deleted: false, ownerId: null, participants: [], previous: [] };

  const previous = (conv.participantIds || []).map(String);
  const active = new Set(await filterActiveMemberIds(conv.workspaceId, previous));
  const participants = previous.filter((id) => active.has(id)); // keeps the order people joined in

  if (participants.length < GROUP_MIN_MEMBERS) {
    await purgeConversation(conv._id);
    return { deleted: true, ownerId: null, participants: [], previous };
  }

  const $set = {};
  if (participants.length !== previous.length) $set.participantIds = participants;
  let ownerId = String(conv.createdBy || "");
  if (!participants.includes(ownerId)) {
    ownerId = participants[0];
    $set.createdBy = ownerId;
  }
  if (Object.keys($set).length) await Conversation.updateOne({ _id: conv._id }, { $set });

  const gone = previous.filter((id) => !active.has(id));
  if (gone.length) await ConversationRead.deleteMany({ conversationId: conv._id, userId: { $in: gone } });
  return { deleted: false, ownerId, participants, previous };
}

// A member leaves by themselves.
export async function leaveGroupConversation(current, conversation) {
  await connectToDatabase();
  await Conversation.updateOne({ _id: conversation._id }, { $pull: { participantIds: current.user.id } });
  await ConversationRead.deleteMany({ conversationId: conversation._id, userId: current.user.id });
  return settleGroup(conversation._id);
}

// A person was deactivated / removed from the workspace: fix every group they were in. Returns what happened per group.
export async function settleGroupsOfUser(workspaceId, userId) {
  await connectToDatabase();
  const groups = await Conversation.find({ workspaceId, type: "group", participantIds: userId }).select("_id").lean();
  const results = [];
  for (const g of groups) {
    const result = await settleGroup(g._id);
    results.push({ id: String(g._id), ...result });
    // remaining members (or, when the group is gone, everybody who was in it) refresh their conversation list
    const notify = result.deleted ? result.previous : result.participants;
    publish(notify.filter((id) => id !== String(userId)), { type: "chat.group", conversationId: String(g._id) });
  }
  return results;
}

/**
 * Manager actions on a group. `body` may contain any of:
 *   name            – new title
 *   addMemberIds    – [userId] workspace members to add
 *   removeMemberId  – userId to take out (not yourself: use "leave")
 *   transferTo      – userId of a member who becomes the new manager
 * Only the manager can do this. Returns { error, status } or { conversation, previous, participants, removed }.
 */
export async function updateGroup(current, conversation, body = {}) {
  const me = current.user.id;
  if (String(conversation.createdBy) !== me) return { error: "فقط مدیر گروه می‌تواند گروه را مدیریت کند.", status: 403 };
  await connectToDatabase();

  const previous = (conversation.participantIds || []).map(String);
  let participants = [...previous];
  const removed = [];
  const $set = {};

  if (body.name !== undefined) {
    const title = cleanGroupName(body.name);
    if (!title) return { error: "نام گروه باید بین ۲ تا ۸۰ کاراکتر باشد.", status: 400 };
    if (title !== conversation.name) $set.name = title;
  }

  if (Array.isArray(body.addMemberIds) && body.addMemberIds.length) {
    const wanted = [...new Set(body.addMemberIds.map(String).filter((id) => mongoose.isValidObjectId(id) && !participants.includes(id)))];
    const active = wanted.length ? await filterActiveMemberIds(current.workspace.id, wanted) : [];
    if (!active.length) return { error: "افراد انتخاب‌شده عضو فعال فضای کاری نیستند یا از قبل در گروه هستند.", status: 400 };
    if (participants.length + active.length > GROUP_MAX_MEMBERS) return { error: `گروه حداکثر ${GROUP_MAX_MEMBERS} عضو می‌تواند داشته باشد.`, status: 400 };
    participants = [...participants, ...active];
  }

  if (body.removeMemberId !== undefined) {
    const id = String(body.removeMemberId);
    if (id === me) return { error: "برای خارج شدن خودتان از «خروج از گروه» استفاده کنید.", status: 400 };
    if (!participants.includes(id)) return { error: "این فرد عضو گروه نیست.", status: 404 };
    participants = participants.filter((x) => x !== id);
    removed.push(id);
    if (participants.length < GROUP_MIN_MEMBERS) return { error: "گروه باید حداقل ۲ عضو داشته باشد. اگر دیگر لازمش ندارید، گروه را حذف کنید.", status: 400 };
  }

  if (body.transferTo !== undefined) {
    const id = String(body.transferTo);
    if (id === me) return { error: "شما همین حالا مدیر گروه هستید.", status: 400 };
    if (!participants.includes(id)) return { error: "مدیر جدید باید عضو گروه باشد.", status: 400 };
    if (!(await filterActiveMemberIds(current.workspace.id, [id])).length) return { error: "این فرد دیگر عضو فعال فضای کاری نیست.", status: 400 };
    $set.createdBy = id;
  }

  if (participants.length !== previous.length || removed.length) $set.participantIds = participants;
  if (!Object.keys($set).length) return { error: "تغییری برای ذخیره وجود ندارد.", status: 400 };

  await Conversation.updateOne({ _id: conversation._id }, { $set });
  if (removed.length) await ConversationRead.deleteMany({ conversationId: conversation._id, userId: { $in: removed } });
  const fresh = await Conversation.findById(conversation._id).lean();
  return { conversation: fresh, previous, participants, removed };
}

export async function clearDirectConversationForMe(current, conversation) {
  await connectToDatabase();
  await ChatMessage.updateMany({ conversationId: conversation._id }, { $addToSet: { hiddenFor: current.user.id } });
  await ConversationRead.updateOne(
    { conversationId: conversation._id, userId: current.user.id },
    { $set: { hidden: true, lastReadAt: new Date() } },
    { upsert: true }
  );
}

// The creator deletes a custom group for everybody.
export async function deleteGroupConversation(conversation) {
  await connectToDatabase();
  await purgeConversation(conversation._id);
}
