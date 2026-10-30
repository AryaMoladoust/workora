import mongoose from "mongoose";

export const PROJECT_STATUSES = ["active", "completed", "archived"];

const projectSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    status: {
      type: String,
      enum: PROJECT_STATUSES,
      default: "active",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    memberIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    startAt: {
      type: Date,
      default: null,
    },
    dueAt: {
      type: Date,
      default: null,
    },
    // labels of this project's tasks (e.g. "urgent", "bug", "design"); tasks store only the ids
    labels: {
      type: [{ _id: false, id: { type: String, required: true }, name: { type: String, trim: true, maxlength: 30 }, color: { type: String, maxlength: 9 } }],
      default: undefined,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

projectSchema.index({ workspaceId: 1, createdAt: -1 });
projectSchema.index({ workspaceId: 1, status: 1 });
projectSchema.index({ workspaceId: 1, memberIds: 1 });

export default mongoose.models.Project || mongoose.model("Project", projectSchema);
