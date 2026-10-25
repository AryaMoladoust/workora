import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { hasPermission } from "../../../../lib/permissions";
import Workspace from "../../../../database/models/Workspace";
import { limitUser } from "../../../../lib/user-limit";

export const runtime = "nodejs";

// PATCH { enabled } → open / close sign-up requests (Gmail + approval)
export async function PATCH(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const limited = await limitUser(current, "member");
  if (limited) return limited;
  if (!hasPermission(current, "members.manage")) {
    return NextResponse.json({ error: "اجازه تغییر این تنظیم را ندارید." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  await connectToDatabase();
  await Workspace.updateOne({ _id: current.workspace.id }, { $set: { signupRequestsEnabled: Boolean(body.enabled) } });
  return NextResponse.json({ enabled: Boolean(body.enabled) });
}
