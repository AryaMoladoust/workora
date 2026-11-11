import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { clearHits, hit } from "../../../../lib/rate-limit";
import { closeVault, openVault } from "../../../../lib/vault";
import User from "../../../../database/models/User";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

// POST { password } – the member's own Workora password opens the passwords section for 30 minutes.
export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const key = `vault-unlock:user:${current.user.id}`;
  const limit = await hit(key, { max: 8, windowSec: 900 });
  if (limit.limited) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterSec / 60));
    return NextResponse.json(
      { error: `تعداد تلاش‌های ناموفق زیاد است. ${minutes.toLocaleString("fa-IR")} دقیقه دیگر دوباره تلاش کنید.` },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  if (!password) return NextResponse.json({ error: "رمز ورک‌اورا را وارد کنید." }, { status: 400, headers: NO_STORE });

  await connectToDatabase();
  const user = await User.findById(current.user.id).select("+passwordHash");
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return NextResponse.json({ error: "رمز درست نیست." }, { status: 400, headers: NO_STORE });
  }

  await clearHits(key);
  await openVault(current);
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}

// DELETE – lock the section again right now.
export async function DELETE() {
  await closeVault();
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
