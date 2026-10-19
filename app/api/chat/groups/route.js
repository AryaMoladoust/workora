import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { createGroupConversation, entryForConversation } from "../../../../lib/chat";
import { publish } from "../../../../lib/realtime";

export const runtime = "nodejs";

// Body: { name, memberIds: [userId] } → creates a custom group chat. The creator is always a member.
export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const result = await createGroupConversation(current, body.name, body.memberIds);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 400 });

    const entry = await entryForConversation(current, result.conversation);
    // tell the other members so the group shows up in their list right away
    const others = (result.conversation.participantIds || []).map(String).filter((id) => id !== current.user.id);
    publish(others, { type: "chat.group", conversationId: entry.id });
    return NextResponse.json({ conversation: entry }, { status: 201 });
  } catch (error) {
    console.error("CHAT_GROUP_ERROR", error);
    return NextResponse.json({ error: "ساخت گروه انجام نشد." }, { status: 500 });
  }
}
