import mongoose from "mongoose";

export const MEMBERSHIP_ROLES = ["owner", "member"];

const membershipSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: MEMBERSHIP_ROLES,
      required: true,
      default: "member",
    },
    permissions: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // "pending" = signed up with an e-mail and waits for an owner/manager to approve (cannot log in yet).
    // Older documents have no status and are treated as active.
    status: {
      type: String,
      enum: ["pending", "active"],
      default: "active",
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

membershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });
membershipSchema.index({ userId: 1, isActive: 1 });

export default
  mongoose.models.Membership || mongoose.model("Membership", membershipSchema);
