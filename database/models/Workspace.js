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
    // Sign-up requests (Gmail + owner approval). Treated as ON unless explicitly false.
    signupRequestsEnabled: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

workspaceSchema.index({ slug: 1 }, { unique: true });

export default
  mongoose.models.Workspace || mongoose.model("Workspace", workspaceSchema);
