import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { fromB64u, isAllowedEndpoint } from "../../../../lib/web-push";
import PushSubscription from "../../../../database/models/PushSubscription";

export const runtime = "nodejs";

const MAX_DEVICES_PER_USER = 10;

// Saves (or re-assigns to the signed-in user) a browser push subscription.
export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const sub = body.subscription || {};
  const endpoint = String(sub.endpoint || "");
  const p256dh = String(sub.keys?.p256dh || "");
  const auth = String(sub.keys?.auth || "");

  if (!isAllowedEndpoint(endpoint) || endpoint.length > 2048) {
    return NextResponse.json({ error: "مرورگر شما پشتیبانی نمی‌شود." }, { status: 400 });
  }
  if (fromB64u(p256dh).length !== 65 || fromB64u(auth).length < 16) {
    return NextResponse.json({ error: "اطلاعات اشتراک نامعتبر است." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          userId: current.user.id,
          workspaceId: current.workspace.id,
          p256dh,
          auth,
          userAgent: String(request.headers.get("user-agent") || "").slice(0, 300),
          lastSeenAt: new Date(),
        },
      },
      { upsert: true }
    );
    // keep only the most recent devices of this user
    const stale = await PushSubscription.find({ userId: current.user.id }).sort({ lastSeenAt: -1 }).skip(MAX_DEVICES_PER_USER).select("_id").lean();
    if (stale.length) await PushSubscription.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUSH_SUBSCRIBE_ERROR", error);
    return NextResponse.json({ error: "ذخیره‌ی اشتراک انجام نشد." }, { status: 500 });
  }
}
