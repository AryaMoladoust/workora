import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../../lib/auth";
import { conversationAccess, MESSAGE_LIMIT, publishToParticipants, serializeOne } from "../../../../../../../lib/chat";
import ChatMessage from "../../../../../../../database/models/ChatMessage";
import Conversation from "../../../../../../../database/models/Conversation";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function load(params) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return { error: bad("احراز هویت لازم است.", 401) };
  if (!mongoose.isValidObjectId(params.messageId)) return { error: bad("شناسه نامعتبر است.") };
  const access = await conversationAccess(current, params.conversationId);
  if (!access) return { error: bad("گفتگو پیدا نشد.", 404) };
  await connectToDatabase();
  const message = await ChatMessage.findOne({ _id: params.messageId, conversationId: access.conversation._id }).lean();
  if (!message) return { error: bad("پیام پیدا نشد.", 404) };
  return { current, access, message };
}

// Authors can edit their own messages (shown with an "edited" label).
export async function PATCH(request, { params }) {
  const ctx = await load(params);
  if (ctx.error) return ctx.error;
  const { current, access, message } = ctx;

  if (String(message.authorId) !== current.user.id) return bad("فقط نویسنده می‌تواند پیام را ویرایش کند.", 403);
  if (message.deletedAt) return bad("این پیام حذف شده است.", 400);

  const body = await request.json().catch(() => ({}));
  const text = String(body.body || "").trim();
  if (!text) return bad("پیام خالی است.");
  if (text.length > MESSAGE_LIMIT) return bad(`پیام نباید بیشتر از ${MESSAGE_LIMIT} کاراکتر باشد.`);
  if (text === message.body) return NextResponse.json({ message: await serializeOne(message) });

  const now = new Date();
  const updated = await ChatMessage.findOneAndUpdate(
    { _id: message._id },
    { $set: { body: text, editedAt: now, changedAt: now } },
    { new: true }
  ).lean();

  // keep the conversation preview in sync when the newest message was edited
  const conv = access.conversation;
  if (conv.lastMessageAt && new Date(conv.lastMessageAt).getTime() === new Date(message.createdAt).getTime()) {
    await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessagePreview: text.slice(0, 120) } });
  }

  const serialized = await serializeOne(updated);
  await publishToParticipants(current, access.participants, { type: "chat.updated", conversationId: String(conv._id), message: serialized });
  return NextResponse.json({ message: serialized });
}

// Authors can delete their own messages (the row stays, shown as "deleted").
export async function DELETE(_request, { params }) {
  const ctx = await load(params);
  if (ctx.error) return ctx.error;
  const { current, access, message } = ctx;

  if (String(message.authorId) !== current.user.id) return bad("فقط نویسنده می‌تواند پیام را حذف کند.", 403);
  if (message.deletedAt) return NextResponse.json({ ok: true });

  const now = new Date();
  await ChatMessage.updateOne(
    { _id: message._id },
    { $set: { deletedAt: now, changedAt: now, body: "—", pinnedAt: null, pinnedBy: null }, $unset: { reactions: "", replyTo: "", mentions: "" } }
  );

  // keep the conversation preview truthful
  const latest = await ChatMessage.findOne({ conversationId: access.conversation._id, deletedAt: null }).sort({ createdAt: -1 }).lean();
  await Conversation.updateOne(
    { _id: access.conversation._id },
    latest
      ? { $set: { lastMessageAt: latest.createdAt, lastMessagePreview: latest.body.slice(0, 120), lastMessageAuthorId: latest.authorId } }
      : { $set: { lastMessageAt: null, lastMessagePreview: "", lastMessageAuthorId: null } }
  );

  await publishToParticipants(current, access.participants, {
    type: "chat.deleted",
    conversationId: String(access.conversation._id),
    messageId: String(message._id),
  });

  return NextResponse.json({ ok: true });
}
