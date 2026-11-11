import mongoose from "mongoose";

export const SECRET_SCOPES = ["private", "users", "workspace"];

// One saved login ("رمز") of one member. The password and the note are stored ENCRYPTED (see lib/vault.js).
// scope: private = only the owner · users = the owner + the members listed in sharedWith · workspace = every member.
const secretSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    username: { type: String, default: "", trim: true, maxlength: 200 },
    url: { type: String, default: "", trim: true, maxlength: 500 },
    password: { type: String, default: "", maxlength: 10000 }, // encrypted ("" = not filled in yet)
    note: { type: String, default: "", maxlength: 40000 }, // encrypted
    scope: { type: String, enum: SECRET_SCOPES, default: "private" },
    sharedWith: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    preset: { type: String, default: "" }, // key of a suggested entry (github, linkedin, ...) or ""
    lastEditedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, versionKey: false }
);

secretSchema.index({ workspaceId: 1, ownerId: 1, updatedAt: -1 });
secretSchema.index({ workspaceId: 1, scope: 1, sharedWith: 1 });

export default mongoose.models.Secret || mongoose.model("Secret", secretSchema);
