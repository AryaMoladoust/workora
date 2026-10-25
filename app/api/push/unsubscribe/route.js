import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import PushSubscription from "../../../../database/models/PushSubscription";
import { limitUser } from "../../../../lib/user-limit";

export const runtime = "nodejs";

// Removes this device's subscription (turning notifications off, or on logout).
export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ ok: true });
  const limited = await limitUser(current, "push");
  if (limited) return limited;
  const body = await request.json().catch(() => ({}));
  const endpoint = String(body.endpoint || "");
  if (!endpoint) return NextResponse.json({ ok: true });
  try {
    await connectToDatabase();
    await PushSubscription.deleteOne({ endpoint, userId: current.user.id });
  } catch (error) {
    console.error("PUSH_UNSUBSCRIBE_ERROR", error);
  }
  return NextResponse.json({ ok: true });
}
