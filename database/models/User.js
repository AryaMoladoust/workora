import mongoose from "mongoose";
import { emailKey } from "../../lib/email-key";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
    },
    // canonical form of the mailbox (dots / "+tag" removed for Gmail …): one mailbox can own only ONE account.
    // Filled automatically from `email`; older accounts get it from /api/setup or at their next login.
    emailKey: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 160,
      default: undefined,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 30,
      default: null,
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    // Last heartbeat from the app (online = seen within the last 2 minutes).
    // true: nobody sees this person's online dot / "last seen" (they are shown as offline)
    hideLastSeen: {
      type: Boolean,
      default: false,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    // Sessions issued before this moment are rejected (set on password change / "sign out everywhere").
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ emailKey: 1 }, { unique: true, partialFilterExpression: { emailKey: { $type: "string" } } });

userSchema.pre("validate", function setEmailKey() {
  if (this.email && (this.isModified("email") || !this.emailKey)) this.emailKey = emailKey(this.email);
});

export default mongoose.models.User || mongoose.model("User", userSchema);
