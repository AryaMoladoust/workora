import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { listConversations } from "../../../../lib/chat";

export const runtime = "nodejs";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  return NextResponse.json(await listConversations(current));
}
