import mongoose from "mongoose";
import { connectToDatabase } from "./db";
import { findAccessibleProject } from "./project-access";
import { filterActiveMemberIds } from "./members";
import { userNameMap } from "./activity";
import { publish } from "./realtime";
import { dayKey, relativeTime, timeOnly } from "./format";
import Conversation from "../database/models/Conversation";
import ChatMessage from "../database/models/ChatMessage";
import ConversationRead from "../database/models/ConversationRead";
import Project from "../database/models/Project";
import User from "../database/models/User";

export const MESSAGE_LIMIT = 4000;

export function directKeyFor(a, b) {
  return [String(a), String(b)].sort().join(":");
}

const isMember = (project, userId) => (project.memberIds || []).map(String).includes(String(userId));

/* ---------------------------------------------------------------- serialization */
export function serializeMessage(message, authorName) {
  const deleted = Boolean(message.deletedAt);
  return {
    id: String(message._id),
    conversationId: String(message.conversationId),
    authorId: String(message.authorId),
    authorName: authorName || "کاربر",
    body: deleted ? "" : message.body,
    deleted,
    createdAt: new Date(message.createdAt).toISOString(),
    dayKey: dayKey(message.createdAt),
    timeText: timeOnly(message.createdAt),
  };
}

export async function serializeMessages(messages) {
  const names = await userNameMap(messages.map((m) => m.authorId));
  return messages.map((m) => serializeMessage(m, names.get(String(m.authorId))));
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
  const candidates = conversations.filter((c) => c.lastMessageAt);
  const reads = await ConversationRead.find({ userId: me, conversationId: { $in: candidates.map((c) => c._id) } }).lean();
  const readAt = new Map(reads.map((r) => [String(r.conversationId), r.lastReadAt]));

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
  return new Map(entries);
}

export async function chatUnreadTotal(current) {
  await connectToDatabase();
  const { conversations } = await myConversationDocs(current);
  const map = await unreadMapFor(current, conversations);
  let total = 0;
  for (const v of map.values()) total += v;
  return total;
}

/* ---------------------------------------------------------------- list */
function entryBase(conversation, me, unread, now) {
  return {
    id: String(conversation._id),
    lastPreview: conversation.lastMessagePreview || "",
    lastMine: conversation.lastMessageAuthorId ? String(conversation.lastMessageAuthorId) === me : false,
    lastAt: conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toISOString() : null,
    lastRelative: conversation.lastMessageAt ? relativeTime(conversation.lastMessageAt, now) : "",
    unread: unread || 0,
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
  const unread = await unreadMapFor(current, conversations);

  const projectById = new Map(visibleProjects.map((p) => [String(p._id), p]));
  const projectEntries = conversations
    .filter((c) => c.type === "project" && projectById.has(String(c.projectId)))
    .map((c) => ({
      ...entryBase(c, me, unread.get(String(c._id)), now),
      kind: "project",
      title: projectById.get(String(c.projectId)).name,
      projectId: String(c.projectId),
    }));

  const directDocs = conversations.filter((c) => c.type === "direct");
  const otherIds = directDocs.map((c) => (c.participantIds || []).map(String).find((id) => id !== me)).filter(Boolean);
  const users = otherIds.length ? await User.find({ _id: { $in: otherIds } }).select("firstName lastName").lean() : [];
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const directEntries = directDocs
    .map((c) => {
      const otherId = (c.participantIds || []).map(String).find((id) => id !== me);
      const other = userById.get(otherId);
      if (!other) return null;
      return {
        ...entryBase(c, me, unread.get(String(c._id)), now),
        kind: "direct",
        title: `${other.firstName} ${other.lastName}`,
        userId: otherId,
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
  const unread = (await unreadMapFor(current, [conversation])).get(String(conversation._id)) || 0;
  if (conversation.type === "project") {
    return { ...entryBase(conversation, me, unread, now), kind: "project", title: project.name, projectId: String(project._id) };
  }
  const otherId = (conversation.participantIds || []).map(String).find((id) => id !== me);
  const other = await User.findById(otherId).select("firstName lastName").lean();
  return {
    ...entryBase(conversation, me, unread, now),
    kind: "direct",
    title: other ? `${other.firstName} ${other.lastName}` : "کاربر",
    userId: otherId,
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
