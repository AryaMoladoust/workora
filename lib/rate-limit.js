import { connectToDatabase } from "./db";
import RateLimit from "../database/models/RateLimit";

export function clientIp(request) {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

// Counts one hit for `key`. Returns { count, limited, retryAfterSec }.
export async function hit(key, { max, windowSec }) {
  await connectToDatabase();
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSec * 1000);

  let doc = await RateLimit.findOneAndUpdate({ key, resetAt: { $gt: now } }, { $inc: { count: 1 } }, { new: true }).lean();
  if (!doc) {
    try {
      // new window (or an expired document the TTL job has not removed yet)
      doc = await RateLimit.findOneAndUpdate({ key }, { $set: { count: 1, resetAt } }, { new: true, upsert: true }).lean();
    } catch (error) {
      if (error?.code !== 11000) throw error;
      doc = await RateLimit.findOneAndUpdate({ key }, { $inc: { count: 1 } }, { new: true }).lean();
    }
  }

  const retryAfterSec = Math.max(1, Math.ceil((new Date(doc.resetAt).getTime() - now.getTime()) / 1000));
  return { count: doc.count, limited: doc.count > max, retryAfterSec };
}

export async function clearHits(key) {
  await connectToDatabase();
  await RateLimit.deleteOne({ key });
}
