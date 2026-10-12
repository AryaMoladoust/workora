import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../lib/auth";
import { conversationAccess, MESSAGE_LIMIT, publishToParticipants, serializeMessage, serializeMessages } from "../../../../../../lib/chat";
import ChatMessage from "../../../../../../database/models/ChatMessage";
import Conversation from "../../../../../../database/models/Conversation";
import ConversationRead from "../../../../../../database/models/ConversationRead";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ?before=<ISO date>&limit=40  → older messages (oldest first in the response)
// ?after=<ISO date>            → messages newer than a moment (used to catch up after a reconnect)
export async function GET(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return bad("گفتگو پیدا نشد.", 404);

  const { searchParams } = new URL(request.url);
  const limit = Math.min(60, Math.max(1, Number.parseInt(searchParams.get("limit") || "40", 10) || 40));
  const before = searchParams.get("before");
  const after = searchParams.get("after");

  const filter = { conversationId: access.conversation._id };
  if (before && !Number.isNaN(Date.parse(before))) filter.createdAt = { $lt: new Date(before) };
  if (after && !Number.isNaN(Date.parse(after))) filter.createdAt = { $gt: new Date(after) };

  await connectToDatabase();
  let rows;
  if (after) {
    rows = await ChatMessage.find(filter).sort({ createdAt: 1 }).limit(200).lean();
  } else {
    rows = (await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean());
  }
  const hasMore = !after && rows.length > limit;
  if (!after) rows = rows.slice(0, limit).reverse();

  return NextResponse.json({ messages: await serializeMessages(rows), hasMore });
}

export async function POST(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return bad("گفتگو پیدا نشد.", 404);

  try {
    const body = await request.json().catch(() => ({}));
    const text = String(body.body || "").trim();
    if (!text) return bad("پیام خالی است.");
    if (text.length > MESSAGE_LIMIT) return bad(`پیام نباید بیشتر از ${MESSAGE_LIMIT} کاراکتر باشد.`);

    await connectToDatabase();
    const message = await ChatMessage.create({
      workspaceId: current.workspace.id,
      conversationId: access.conversation._id,
      authorId: current.user.id,
      body: text,
    });

    await Promise.all([
      Conversation.updateOne(
        { _id: access.conversation._id },
        { $set: { lastMessageAt: message.createdAt, lastMessagePreview: text.slice(0, 120), lastMessageAuthorId: current.user.id } }
      ),
      // the sender has obviously read everything up to now
      ConversationRead.updateOne(
        { conversationId: access.conversation._id, userId: current.user.id },
        { $set: { lastReadAt: message.createdAt } },
        { upsert: true }
      ),
    ]);

    const serialized = serializeMessage(message.toObject(), `${current.user.firstName} ${current.user.lastName}`);
    await publishToParticipants(current, access.participants, {
      type: "chat.message",
      conversationId: String(access.conversation._id),
      kind: access.conversation.type,
      projectId: access.conversation.projectId ? String(access.conversation.projectId) : null,
      message: serialized,
    });

    return NextResponse.json({ message: serialized }, { status: 201 });
  } catch (error) {
    console.error("CHAT_SEND_ERROR", error);
    return bad("ارسال پیام انجام نشد.", 500);
  }
}
