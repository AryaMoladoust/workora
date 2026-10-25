import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { createSession, getCurrentUser } from "../../../../lib/auth";
import User from "../../../../database/models/User";
import { limitUser } from "../../../../lib/user-limit";

export const runtime = "nodejs";

// POST – sign out of every other device (all older sessions stop working; this one is renewed).
export async function POST() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const limited = await limitUser(current, "profile");
  if (limited) return limited;

  await connectToDatabase();
  await User.updateOne({ _id: current.user.id }, { $set: { passwordChangedAt: new Date() } });
  await createSession({ userId: current.user.id, workspaceId: current.workspace.id, membershipId: current.membership.id });
  return NextResponse.json({ ok: true });
}
