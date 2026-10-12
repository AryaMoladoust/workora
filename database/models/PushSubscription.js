import mongoose from "mongoose";

// One row per browser/device that enabled push notifications.
const pushSubscriptionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
    endpoint: { type: String, required: true },
    p256dh: { type: String, required: true },
    auth: { type: String, required: true },
    userAgent: { type: String, default: "" },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });
pushSubscriptionSchema.index({ userId: 1, lastSeenAt: -1 });

export default mongoose.models.PushSubscription || mongoose.model("PushSubscription", pushSubscriptionSchema);
