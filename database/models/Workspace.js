import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      maxlength: 80,
    },
    ownerUserIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
      validate: {
        validator(value) {
          return value.length <= 2;
        },
        message: "A workspace cannot have more than two owners.",
      },
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Self-registration of team members: people who know the code can create a member account.
    inviteCode: { type: String, default: undefined },
    inviteEnabled: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

workspaceSchema.index({ slug: 1 }, { unique: true });
workspaceSchema.index({ inviteCode: 1 }, { unique: true, sparse: true });

export default
  mongoose.models.Workspace || mongoose.model("Workspace", workspaceSchema);
