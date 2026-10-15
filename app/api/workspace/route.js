import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { hasPermission } from "../../../lib/permissions";
import Workspace from "../../../database/models/Workspace";

export const runtime = "nodejs";

// PATCH { name } – rename the workspace (needs the "settings.manage" permission).
export async function PATCH(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  if (!hasPermission(current, "settings.manage")) {
    return NextResponse.json({ error: "اجازه تغییر تنظیمات فضای کاری را ندارید." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (name.length < 2 || name.length > 120) {
    return NextResponse.json({ error: "نام فضای کاری باید بین ۲ تا ۱۲۰ حرف باشد." }, { status: 400 });
  }

  await connectToDatabase();
  await Workspace.updateOne({ _id: current.workspace.id }, { $set: { name } });
  return NextResponse.json({ ok: true, name });
}
