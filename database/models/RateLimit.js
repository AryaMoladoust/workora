import mongoose from "mongoose";

// Fixed-window counters (login / register throttling). Stored in MongoDB so it works across
// serverless instances; documents are removed automatically by the TTL index when the window ends.
const rateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    resetAt: { type: Date, required: true },
  },
  { versionKey: false }
);

rateLimitSchema.index({ resetAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RateLimit || mongoose.model("RateLimit", rateLimitSchema);
