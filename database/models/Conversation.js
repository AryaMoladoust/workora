import mongoose from "mongoose";

export const CONVERSATION_TYPES = ["project", "direct"];

// "project": one shared room per project (participants = project members).
// "direct": a private conversation between exactly two members (directKey = sorted ids joined by ":").
const conversationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    type: { type: String, enum: CONVERSATION_TYPES, required: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: undefined },
    participantIds: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
    directKey: { type: String, default: undefined },
    lastMessageAt: { type: Date, default: null },
    lastMessagePreview: { type: String, default: "" },
    lastMessageAuthorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false }
);

conversationSchema.index(
  { workspaceId: 1, projectId: 1 },
  { unique: true, partialFilterExpression: { type: "project" } }
);
conversationSchema.index({ directKey: 1 }, { unique: true, partialFilterExpression: { type: "direct" } });
conversationSchema.index({ participantIds: 1, lastMessageAt: -1 });

export default mongoose.models.Conversation || mongoose.model("Conversation", conversationSchema);
