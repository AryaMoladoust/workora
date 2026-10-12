import mongoose from "mongoose";

// Fallback storage for the VAPID key pair when VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set in the environment.
const pushConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    publicKey: { type: String, required: true },
    privateKey: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

export default mongoose.models.PushConfig || mongoose.model("PushConfig", pushConfigSchema);
