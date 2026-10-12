import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth";
import { listNotifications, unreadCountFor } from "../../../lib/notifications";
import { chatUnreadTotal } from "../../../lib/chat";

export const runtime = "nodejs";

export async function GET(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  if (searchParams.get("summary")) {
    const [unread, chatUnread] = await Promise.all([unreadCountFor(current), chatUnreadTotal(current)]);
    return NextResponse.json({ unread, chatUnread });
  }

  const limit = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("limit") || "10", 10) || 10));
  const data = await listNotifications(current, { unreadOnly: searchParams.get("unread") === "1", limit });
  return NextResponse.json({ notifications: data.items, unread: data.unread });
}
