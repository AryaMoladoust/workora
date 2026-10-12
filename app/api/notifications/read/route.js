import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { markNotificationsRead, unreadCountFor } from "../../../../lib/notifications";

export const runtime = "nodejs";

export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  await markNotificationsRead(current, { ids: body.ids, all: Boolean(body.all) });
  return NextResponse.json({ ok: true, unread: await unreadCountFor(current) });
}
