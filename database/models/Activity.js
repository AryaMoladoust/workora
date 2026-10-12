import mongoose from "mongoose";

// Append-only audit trail. Names/titles are stored denormalized so old entries stay readable
// even after a task, project or user is renamed or deleted.
const activitySchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null, index: true },
    projectName: { type: String, default: "" },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorName: { type: String, default: "" },
    type: { type: String, required: true, index: true },
    entityType: { type: String, enum: ["task", "project", "member", "comment"], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    entityTitle: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

activitySchema.index({ workspaceId: 1, createdAt: -1 });
activitySchema.index({ workspaceId: 1, projectId: 1, createdAt: -1 });

export default mongoose.models.Activity || mongoose.model("Activity", activitySchema);
