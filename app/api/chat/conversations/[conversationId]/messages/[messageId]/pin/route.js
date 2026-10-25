import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../../../lib/auth";
import { conversationAccess, MAX_PINS, publishToParticipants, serializeOne } from "../../../../../../../../lib/chat";
import ChatMessage from "../../../../../../../../database/models/ChatMessage";
import { limitUser } from "../../../../../../../../lib/user-limit";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Body: { pinned: boolean }. Every participant of the conversation can pin / unpin.
export async function POST(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const limited = await limitUser(current, "chat:pin");
  if (limited) return limited;
  if (!mongoose.isValidObjectId(params.messageId)) return bad("شناسه نامعتبر است.");

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return bad("گفتگو پیدا نشد.", 404);

  const body = await request.json().catch(() => ({}));
  if (typeof body.pinned !== "boolean") return bad("درخواست نامعتبر است.");

  await connectToDatabase();
  const message = await ChatMessage.findOne({ _id: params.messageId, conversationId: access.conversation._id, deletedAt: null }).lean();
  if (!message) return bad("پیام پیدا نشد.", 404);

  if (body.pinned && !message.pinnedAt) {
    const count = await ChatMessage.countDocuments({ conversationId: access.conversation._id, pinnedAt: { $ne: null }, deletedAt: null });
    if (count >= MAX_PINS) return bad(`حداکثر ${MAX_PINS.toLocaleString("fa-IR")} پیام را می‌توان سنجاق کرد.`);
  }

  const now = new Date();
  const updated = await ChatMessage.findOneAndUpdate(
    { _id: message._id },
    body.pinned
      ? { $set: { pinnedAt: message.pinnedAt || now, pinnedBy: current.user.id, changedAt: now } }
      : { $set: { pinnedAt: null, pinnedBy: null, changedAt: now } },
    { new: true }
  ).lean();

  const serialized = await serializeOne(updated);
  await publishToParticipants(current, access.participants, { type: "chat.updated", conversationId: String(access.conversation._id), message: serialized });
  return NextResponse.json({ message: serialized });
}
