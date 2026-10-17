import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../../../lib/auth";
import { conversationAccess, publishToParticipants, REACTION_EMOJIS, serializeOne } from "../../../../../../../../lib/chat";
import ChatMessage from "../../../../../../../../database/models/ChatMessage";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Body: { emoji }. A person has one reaction per message: the same emoji again removes it, another emoji replaces it.
export async function POST(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  if (!mongoose.isValidObjectId(params.messageId)) return bad("شناسه نامعتبر است.");

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return bad("گفتگو پیدا نشد.", 404);

  const body = await request.json().catch(() => ({}));
  const emoji = String(body.emoji || "");
  if (!REACTION_EMOJIS.includes(emoji)) return bad("این واکنش مجاز نیست.");

  await connectToDatabase();
  const message = await ChatMessage.findOne({ _id: params.messageId, conversationId: access.conversation._id, deletedAt: null }).lean();
  if (!message) return bad("پیام پیدا نشد.", 404);

  const me = current.user.id;
  const groups = (message.reactions || []).map((r) => ({ emoji: r.emoji, userIds: r.userIds.map(String) }));
  const had = groups.find((g) => g.userIds.includes(me));
  for (const g of groups) g.userIds = g.userIds.filter((id) => id !== me);
  if (!had || had.emoji !== emoji) {
    const target = groups.find((g) => g.emoji === emoji);
    if (target) target.userIds.push(me);
    else groups.push({ emoji, userIds: [me] });
  }
  const reactions = groups.filter((g) => g.userIds.length);

  const updated = await ChatMessage.findOneAndUpdate(
    { _id: message._id },
    { $set: { reactions, changedAt: new Date() } },
    { new: true }
  ).lean();

  const serialized = await serializeOne(updated);
  await publishToParticipants(current, access.participants, { type: "chat.updated", conversationId: String(access.conversation._id), message: serialized });
  return NextResponse.json({ message: serialized });
}
