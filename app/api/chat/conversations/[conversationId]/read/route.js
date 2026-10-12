import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../../lib/auth";
import { conversationAccess, markConversationRead } from "../../../../../../lib/chat";

export const runtime = "nodejs";

export async function POST(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const access = await conversationAccess(current, params.conversationId);
  if (!access) return NextResponse.json({ error: "گفتگو پیدا نشد." }, { status: 404 });

  const unread = await markConversationRead(current, access.conversation._id);
  return NextResponse.json({ ok: true, unread });
}
