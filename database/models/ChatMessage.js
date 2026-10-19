import mongoose from "mongoose";

// One emoji reaction group on a message (a user has at most one reaction per message).
const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    userIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  },
  { _id: false }
);

// Snapshot of the message being replied to (kept even if the original is edited or deleted later).
const replySchema = new mongoose.Schema(
  {
    messageId: { type: mongoose.Schema.Types.ObjectId, required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, default: null },
    authorName: { type: String, default: "" },
    preview: { type: String, default: "" },
  },
  { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 4000 },
    deletedAt: { type: Date, default: null },
    // "delete for me": users who hid this message from their own view (everyone else still sees it)
    hiddenFor: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
    replyTo: { type: replySchema, default: undefined },
    mentions: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
    editedAt: { type: Date, default: null },
    reactions: { type: [reactionSchema], default: undefined },
    pinnedAt: { type: Date, default: null },
    pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // bumped on every edit / reaction / pin / delete so polling clients can fetch what changed
    changedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });
chatMessageSchema.index({ conversationId: 1, changedAt: 1 });
chatMessageSchema.index({ conversationId: 1, pinnedAt: -1 }, { partialFilterExpression: { pinnedAt: { $type: "date" } } });

export default mongoose.models.ChatMessage || mongoose.model("ChatMessage", chatMessageSchema);
