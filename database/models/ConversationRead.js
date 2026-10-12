import mongoose from "mongoose";

// When a user last read a conversation (unread = messages by others after this moment).
const conversationReadSchema = new mongoose.Schema(
  {
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastReadAt: { type: Date, required: true, default: Date.now },
  },
  { versionKey: false }
);

conversationReadSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
conversationReadSchema.index({ userId: 1 });

export default mongoose.models.ConversationRead || mongoose.model("ConversationRead", conversationReadSchema);
