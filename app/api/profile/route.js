import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { validateName } from "../../../lib/validation";
import User from "../../../database/models/User";
import { limitUser } from "../../../lib/user-limit";

export const runtime = "nodejs";

// PATCH { firstName, lastName, phone, hideLastSeen } – the signed-in user edits their own profile.
export async function PATCH(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const limited = await limitUser(current, "profile");
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const firstName = String(body.firstName ?? current.user.firstName).trim();
  const lastName = String(body.lastName ?? current.user.lastName).trim();
  const phone = String(body.phone ?? "").trim().slice(0, 30);
  const problem = validateName(firstName, "نام") || validateName(lastName, "نام خانوادگی");
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (phone && !/^[0-9۰-۹+\-\s()]{5,30}$/.test(phone)) {
    return NextResponse.json({ error: "شماره تلفن معتبر نیست." }, { status: 400 });
  }

  const $set = { firstName, lastName, phone: phone || null };
  // privacy: only changed when the form actually sends it
  if (body.hideLastSeen !== undefined) $set.hideLastSeen = Boolean(body.hideLastSeen);

  await connectToDatabase();
  await User.updateOne({ _id: current.user.id }, { $set });
  return NextResponse.json({ ok: true, firstName, lastName, phone, hideLastSeen: $set.hideLastSeen });
}
