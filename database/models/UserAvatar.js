import mongoose from "mongoose";

// The profile photo of a user (a small, already resized image). Kept apart from User so that the user
// document stays tiny; it is served by /api/avatar/[userId] and cached by the browser.
const userAvatarSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    contentType: { type: String, required: true, enum: ["image/jpeg", "image/png", "image/webp"] },
    data: { type: Buffer, required: true },
  },
  { timestamps: true, versionKey: false }
);

userAvatarSchema.index({ userId: 1 }, { unique: true });

export default mongoose.models.UserAvatar || mongoose.model("UserAvatar", userAvatarSchema);
