import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { sendPushToUsers } from "../../../../lib/push";
import { limitUser } from "../../../../lib/user-limit";

export const runtime = "nodejs";

// Sends a test notification to all devices of the signed-in user.
export async function POST() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const limited = await limitUser(current, "push");
  if (limited) return limited;
  const result = await sendPushToUsers(
    [current.user.id],
    { title: "Workora", body: "اعلان‌ها درست کار می‌کنند ✅", url: "/dashboard", tag: "test", kind: "test" },
    { urgency: "high", ttl: 120 }
  );
  return NextResponse.json({ ok: result.sent > 0, ...result });
}
