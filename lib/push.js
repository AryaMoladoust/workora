// Push notifications: VAPID keys, sending to users, and the payload builders used by notify() and chat.
import mongoose from "mongoose";
import { after } from "next/server";
import { connectToDatabase } from "./db";
import { generateVapidKeys, sendEncrypted } from "./web-push";
import PushSubscription from "../database/models/PushSubscription";
import PushConfig from "../database/models/PushConfig";

const g = globalThis;
const MAX_BODY = 140;

/* ------------------------------------------------------------------ VAPID */
// Preferred: VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY (+ VAPID_SUBJECT) in the environment  (npm run vapid).
// Fallback: a key pair generated once and stored in MongoDB, so push works out of the box.
export async function getVapid() {
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@workora.app";
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY.trim(), privateKey: process.env.VAPID_PRIVATE_KEY.trim(), subject };
  }
  if (g.__workoraVapid) return { ...g.__workoraVapid, subject };

  await connectToDatabase();
  let doc = await PushConfig.findOne({ key: "vapid" }).lean();
  if (!doc) {
    const keys = generateVapidKeys();
    try {
      doc = await PushConfig.findOneAndUpdate({ key: "vapid" }, { $setOnInsert: keys }, { upsert: true, new: true }).lean();
    } catch (error) {
      if (error?.code !== 11000) throw error;
      doc = await PushConfig.findOne({ key: "vapid" }).lean(); // another instance won the race
    }
  }
  g.__workoraVapid = { publicKey: doc.publicKey, privateKey: doc.privateKey };
  return { ...g.__workoraVapid, subject };
}

/* ------------------------------------------------------------------ sending */
function clip(text, max) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// Sends a notification to every device of the given users. Never throws.
// Returns { devices, sent, removed, failed, statuses } (handy for the "test notification" button).
export async function sendPushToUsers(userIds, payload, options = {}) {
  const result = { devices: 0, sent: 0, removed: 0, failed: 0, statuses: [] };
  try {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))].filter((id) => mongoose.isValidObjectId(id));
    if (!ids.length) return result;

    const vapid = await getVapid();
    await connectToDatabase();
    const subs = await PushSubscription.find({ userId: { $in: ids } }).lean();
    result.devices = subs.length;
    if (!subs.length) return result;

    const body = JSON.stringify({
      title: clip(payload.title || "Workora", 80),
      body: clip(payload.body, MAX_BODY),
      url: payload.url || "/dashboard",
      tag: payload.tag || undefined,
      kind: payload.kind || "notification",
    });

    const outcomes = await Promise.all(
      subs.map(async (sub) => ({ sub, res: await sendEncrypted(sub, body, vapid, { ttl: options.ttl ?? 3600, urgency: options.urgency ?? "normal", topic: payload.tag }) }))
    );

    const dead = [];
    for (const { sub, res } of outcomes) {
      result.statuses.push(res.status);
      if (res.ok) result.sent += 1;
      else {
        result.failed += 1;
        if (res.gone) dead.push(sub._id);
        else console.error("PUSH_SEND_FAILED", res.status, res.error || "");
      }
    }
    if (dead.length) {
      await PushSubscription.deleteMany({ _id: { $in: dead } });
      result.removed = dead.length;
    }
  } catch (error) {
    console.error("PUSH_ERROR", error);
  }
  return result;
}

// Fire-and-forget: runs after the HTTP response (Next.js after()), falls back to a plain promise.
export function schedulePush(userIds, payload, options) {
  const job = () => sendPushToUsers(userIds, payload, options).catch(() => {});
  try {
    after(job);
  } catch {
    job();
  }
}

/* ------------------------------------------------------------------ payload builders */
export function pushForChatMessage({ senderName, projectName, conversationId, text, kind }) {
  const preview = clip(text, MAX_BODY);
  return {
    title: kind === "project" ? `${projectName || "چت پروژه"}` : kind === "group" ? `${projectName || "گروه"}` : senderName,
    body: kind === "project" || kind === "group" ? `${senderName}: ${preview}` : preview,
    url: `/chat?c=${conversationId}`,
    tag: `chat-${conversationId}`,
    kind: "chat",
  };
}
