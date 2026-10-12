import mongoose from "mongoose";

export const NOTE_KINDS = ["note", "config"];
export const NOTE_SCOPES = ["private", "workspace", "project"];

// One engine for both "یادداشت‌ها" (notes) and "کانفیگ‌ها" (configs: v2ray, env snippets, ...).
const noteSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    kind: { type: String, enum: NOTE_KINDS, required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    body: { type: String, default: "", maxlength: 200000 },
    tags: { type: [String], default: [] },
    scope: { type: String, enum: NOTE_SCOPES, default: "private" },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

noteSchema.index({ workspaceId: 1, kind: 1, scope: 1, updatedAt: -1 });
noteSchema.index({ workspaceId: 1, kind: 1, ownerId: 1, updatedAt: -1 });
noteSchema.index({ workspaceId: 1, projectId: 1 });

export default mongoose.models.Note || mongoose.model("Note", noteSchema);
