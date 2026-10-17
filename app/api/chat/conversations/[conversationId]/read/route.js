import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { conversationAccess, markConversationRead, publishToParticipants } from "../../../../../../lib/chat";

export const runtime = "nodejs";

export async function POST(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return NextResponse.json({ error: "گفتگو پیدا نشد." }, { status: 404 });

  const unread = await markConversationRead(current, access.conversation._id);
  // let the others see the double tick right away
  await publishToParticipants(current, access.participants, {
    type: "chat.read",
    conversationId: String(access.conversation._id),
    userId: current.user.id,
    at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true, unread });
}
