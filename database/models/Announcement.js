import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, default: "" },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: 10000 },
    pinned: { type: Boolean, default: false },
  },
  { timestamps: true, versionKey: false }
);

announcementSchema.index({ workspaceId: 1, pinned: -1, createdAt: -1 });

export default mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);
