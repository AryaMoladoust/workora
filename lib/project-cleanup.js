import { connectToDatabase } from "./db";
import { publish } from "./realtime";
import ChatMessage from "../database/models/ChatMessage";
import Comment from "../database/models/Comment";
import Conversation from "../database/models/Conversation";
import ConversationRead from "../database/models/ConversationRead";
import Note from "../database/models/Note";
import Notification from "../database/models/Notification";
import Task from "../database/models/Task";

// Removes everything that belongs to a project, so deleting it leaves no orphan data behind:
// tasks, task comments, the project chat room (+ its messages and read markers), notes attached to the project
// and the notifications that point at it. The activity log is kept on purpose (it is the audit trail;
// the "project.deleted" entry is written by the caller).
// Safe to run again if an earlier attempt stopped half way.
export async function deleteProjectData(workspaceId, project) {
  await connectToDatabase();
  const projectId = project._id;

  const rooms = await Conversation.find({ workspaceId, type: "project", projectId }).select("_id").lean();
  const roomIds = rooms.map((r) => r._id);

  const [tasks, comments, notes, notifications] = await Promise.all([
    Task.deleteMany({ workspaceId, projectId }),
    Comment.deleteMany({ workspaceId, projectId }),
    Note.deleteMany({ workspaceId, projectId }),
    Notification.deleteMany({ workspaceId, projectId }),
  ]);

  let messages = { deletedCount: 0 };
  if (roomIds.length) {
    [messages] = await Promise.all([
      ChatMessage.deleteMany({ conversationId: { $in: roomIds } }),
      ConversationRead.deleteMany({ conversationId: { $in: roomIds } }),
    ]);
    await Conversation.deleteMany({ _id: { $in: roomIds } });
    // people with the chat open get their conversation list refreshed
    publish((project.memberIds || []).map(String), { type: "chat.group", conversationId: String(roomIds[0]) });
  }

  return {
    tasks: tasks.deletedCount || 0,
    comments: comments.deletedCount || 0,
    notes: notes.deletedCount || 0,
    notifications: notifications.deletedCount || 0,
    messages: messages.deletedCount || 0,
    rooms: roomIds.length,
  };
}
