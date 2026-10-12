import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 3000 },
  },
  { timestamps: true, versionKey: false }
);

commentSchema.index({ taskId: 1, createdAt: 1 });

export default mongoose.models.Comment || mongoose.model("Comment", commentSchema);
