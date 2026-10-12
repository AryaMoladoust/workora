import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../../lib/auth";
import { conversationAccess, publishToParticipants } from "../../../../../../../lib/chat";
import ChatMessage from "../../../../../../../database/models/ChatMessage";
import Conversation from "../../../../../../../database/models/Conversation";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Authors can delete their own messages (the row stays, shown as "deleted").
export async function DELETE(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  if (!mongoose.isValidObjectId(params.messageId)) return bad("شناسه نامعتبر است.");

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return bad("گفتگو پیدا نشد.", 404);

  await connectToDatabase();
  const message = await ChatMessage.findOne({ _id: params.messageId, conversationId: access.conversation._id }).lean();
  if (!message) return bad("پیام پیدا نشد.", 404);
  if (String(message.authorId) !== current.user.id) return bad("فقط نویسنده می‌تواند پیام را حذف کند.", 403);
  if (message.deletedAt) return NextResponse.json({ ok: true });

  await ChatMessage.updateOne({ _id: message._id }, { $set: { deletedAt: new Date(), body: "—" } });

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
