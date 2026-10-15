import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "../../../../lib/db";
import { createSession, getCurrentUser } from "../../../../lib/auth";
import { hit } from "../../../../lib/rate-limit";
import { validatePassword } from "../../../../lib/validation";
import User from "../../../../database/models/User";

export const runtime = "nodejs";

// PATCH { currentPassword, newPassword } – change your own password.
// Every other device is signed out; this one stays signed in.
export async function PATCH(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const limit = await hit(`pw-change:user:${current.user.id}`, { max: 8, windowSec: 900 });
  if (limit.limited) {
    return NextResponse.json({ error: "تعداد تلاش‌ها زیاد است. چند دقیقه بعد دوباره تلاش کنید." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  if (!currentPassword) return NextResponse.json({ error: "رمز عبور فعلی را وارد کنید." }, { status: 400 });
  const problem = validatePassword(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (newPassword === currentPassword) {
    return NextResponse.json({ error: "رمز جدید باید با رمز فعلی فرق داشته باشد." }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findById(current.user.id).select("+passwordHash");
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: "رمز عبور فعلی درست نیست." }, { status: 400 });
  }

  await User.updateOne({ _id: user._id }, { $set: { passwordHash: await bcrypt.hash(newPassword, 12), passwordChangedAt: new Date() } });
  await createSession({ userId: current.user.id, workspaceId: current.workspace.id, membershipId: current.membership.id });
  return NextResponse.json({ ok: true });
}
