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

    // small steps with a tick (the progress bar of the task is filled from them)
    checklist: { type: [{ _id: false, text: { type: String, trim: true, maxlength: 200 }, done: { type: Boolean, default: false } }], default: undefined },
    // ids of labels defined on the project (Project.labels)
    labelIds: { type: [String], default: undefined },
    // "repeat every N days / weeks / Jalali months"; the next copy is created when this one is finished
    // { every: "daily" | "weekly" | "monthly", interval: 1..30 } - cleaned by sanitizeRecurrence() in lib/task-logic.js
    recurrence: { type: mongoose.Schema.Types.Mixed, default: undefined },
    recurrenceSpawned: { type: Boolean, default: false }, // the next copy already exists (never create two)
    seriesId: { type: mongoose.Schema.Types.ObjectId, default: null }, // first task of a repeating series
    // tasks of the same project that must be finished before this one can start
    blockedBy: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
    // deadline reminders already sent for the CURRENT due date (cleared when the due date changes)
    // { dueSoonAt: Date, overdueAt: Date }
    reminders: { type: mongoose.Schema.Types.Mixed, default: undefined },
  },
  { timestamps: true, versionKey: false }
);

taskSchema.index({ workspaceId: 1, projectId: 1, createdAt: -1 });
taskSchema.index({ workspaceId: 1, assigneeId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, projectId: 1, status: 1 });
taskSchema.index({ workspaceId: 1, createdBy: 1 });
taskSchema.index({ blockedBy: 1 }, { sparse: true });
// the daily reminder job looks for open tasks with a due date
taskSchema.index({ status: 1, dueAt: 1 });

export default mongoose.models.Task || mongoose.model("Task", taskSchema);
