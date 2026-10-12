import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { entryForConversation, openDirectConversation, openProjectConversation } from "../../../../lib/chat";

export const runtime = "nodejs";

// Body: { projectId } for a project room, or { userId } for a direct conversation.
export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  try {
    const body = await request.json().catch(() => ({}));
    const result = body.projectId
      ? await openProjectConversation(current, body.projectId)
      : await openDirectConversation(current, body.userId);

    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 400 });
    const entry = await entryForConversation(current, result.conversation, result.project);
    return NextResponse.json({ conversation: entry });
  } catch (error) {
    console.error("CHAT_OPEN_ERROR", error);
    return NextResponse.json({ error: "باز کردن گفتگو انجام نشد." }, { status: 500 });
  }
}
