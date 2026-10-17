import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../../../lib/db";
import { getCurrentUser } from "../../../../../../lib/auth";
import {
  conversationAccess,
  MESSAGE_LIMIT,
  messagesAround,
  notifyMentions,
  publishToParticipants,
  pushChatMessage,
  readsOf,
  replySnapshot,
  resolveMentions,
  searchMessages,
  serializeMessages,
  serializeOne,
} from "../../../../../../lib/chat";
import ChatMessage from "../../../../../../database/models/ChatMessage";
import Conversation from "../../../../../../database/models/Conversation";
import ConversationRead from "../../../../../../database/models/ConversationRead";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ?before=<ISO date>&limit=40  → older messages (oldest first in the response)
// ?after=<ISO date>            → messages newer than a moment (used to catch up after a reconnect)
// ?since=<ISO date>            → also returns messages edited / reacted / pinned / deleted after that moment (`updated`)
// ?around=<messageId>          → a window of messages around one message (jump to a search result or a quote)
// ?q=text                      → search inside this conversation (newest first)
export async function GET(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return bad("گفتگو پیدا نشد.", 404);

  const { searchParams } = new URL(request.url);
  await connectToDatabase();

  const q = searchParams.get("q");
  if (q !== null) return NextResponse.json({ results: await searchMessages(access.conversation._id, q) });

  const around = searchParams.get("around");
  if (around) {
    const window = await messagesAround(access.conversation._id, around);
    if (!window) return bad("پیام پیدا نشد.", 404);
    return NextResponse.json({ ...window, reads: await readsOf(access.conversation._id, current.user.id), now: new Date().toISOString() });
  }

  const limit = Math.min(60, Math.max(1, Number.parseInt(searchParams.get("limit") || "40", 10) || 40));
  const before = searchParams.get("before");
  const after = searchParams.get("after");
  const since = searchParams.get("since");

  const filter = { conversationId: access.conversation._id };
  if (before && !Number.isNaN(Date.parse(before))) filter.createdAt = { $lt: new Date(before) };
  if (after && !Number.isNaN(Date.parse(after))) filter.createdAt = { $gt: new Date(after) };

  let rows;
  if (after) {
    rows = await ChatMessage.find(filter).sort({ createdAt: 1 }).limit(200).lean();
  } else {
    rows = await ChatMessage.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean();
  }
  const hasMore = !after && rows.length > limit;
  if (!after) rows = rows.slice(0, limit).reverse();

  let updated = [];
  if (since && !Number.isNaN(Date.parse(since))) {
    const changed = await ChatMessage.find({ conversationId: access.conversation._id, changedAt: { $gt: new Date(since) } })
      .sort({ changedAt: 1 })
      .limit(200)
      .lean();
    updated = await serializeMessages(changed);
  }

  const [messages, reads] = await Promise.all([serializeMessages(rows), readsOf(access.conversation._id, current.user.id)]);
  return NextResponse.json({ messages, hasMore, updated, reads, now: new Date().toISOString() });
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
    const [replyTo, mentions] = await Promise.all([
      replySnapshot(access, body.replyToId),
      resolveMentions(current, access, text, body.mentions),
    ]);

    const message = await ChatMessage.create({
      workspaceId: current.workspace.id,
      conversationId: access.conversation._id,
      authorId: current.user.id,
      body: text,
      ...(replyTo ? { replyTo } : {}),
      ...(mentions.length ? { mentions } : {}),
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

    const serialized = await serializeOne(message.toObject());
    await publishToParticipants(current, access.participants, {
      type: "chat.message",
      conversationId: String(access.conversation._id),
      kind: access.conversation.type,
      projectId: access.conversation.projectId ? String(access.conversation.projectId) : null,
      message: serialized,
    });

    await Promise.all([
      pushChatMessage(current, access, text, { skipIds: mentions }),
      notifyMentions(current, access, mentions, text),
    ]);

    return NextResponse.json({ message: serialized }, { status: 201 });
  } catch (error) {
    console.error("CHAT_SEND_ERROR", error);
    return bad("ارسال پیام انجام نشد.", 500);
  }
}
