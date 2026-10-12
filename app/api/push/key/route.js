import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { getVapid } from "../../../../lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public VAPID key (needed by the browser to subscribe).
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  try {
    const { publicKey } = await getVapid();
    return NextResponse.json({ publicKey });
  } catch (error) {
    console.error("PUSH_KEY_ERROR", error);
    return NextResponse.json({ error: "کلید اعلان در دسترس نیست." }, { status: 500 });
  }
}
