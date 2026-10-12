import mongoose from "mongoose";

export const TASK_STATUSES = ["todo", "in_progress", "done"];
export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"];

const taskSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 240 },
    description: { type: String, trim: true, maxlength: 10000, default: "" },
    status: { type: String, enum: TASK_STATUSES, default: "todo", index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: "medium", index: true },
    assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    startAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false }
);

taskSchema.index({ workspaceId: 1, projectId: 1, createdAt: -1 });
taskSchema.index({ workspaceId: 1, assigneeId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, projectId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, createdBy: 1 });

export default mongoose.models.Task || mongoose.model("Task", taskSchema);
