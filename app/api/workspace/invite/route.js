import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { hasPermission } from "../../../../lib/permissions";
import { displayInviteCode, generateInviteCode, storedInviteCode } from "../../../../lib/invite";
import Workspace from "../../../../database/models/Workspace";

export const runtime = "nodejs";

async function authorize() {
  const current = await getCurrentUser();
  if (!current) return { error: NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 }) };
  if (!hasPermission(current, "members.manage")) {
    return { error: NextResponse.json({ error: "اجازه مدیریت کد دعوت را ندارید." }, { status: 403 }) };
  }
  return { current };
}

function view(workspace) {
  return { enabled: Boolean(workspace.inviteEnabled && workspace.inviteCode), code: workspace.inviteCode ? displayInviteCode(workspace.inviteCode) : "" };
}

export async function GET() {
  const { current, error } = await authorize();
  if (error) return error;
  await connectToDatabase();
  const workspace = await Workspace.findById(current.workspace.id).lean();
  return NextResponse.json(view(workspace));
}

// POST → create a NEW code (the old one stops working) and enable sign-up with it
export async function POST() {
  const { current, error } = await authorize();
  if (error) return error;
  await connectToDatabase();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const code = storedInviteCode(generateInviteCode());
      const workspace = await Workspace.findByIdAndUpdate(
        current.workspace.id,
        { $set: { inviteCode: code, inviteEnabled: true } },
        { new: true }
      ).lean();
      return NextResponse.json(view(workspace));
    } catch (err) {
      if (err?.code !== 11000) throw err; // code collision → try again
    }
  }
  return NextResponse.json({ error: "ساخت کد دعوت انجام نشد." }, { status: 500 });
}

// PATCH { enabled } → switch sign-up on/off without changing the code
export async function PATCH(request) {
  const { current, error } = await authorize();
  if (error) return error;
  const body = await request.json().catch(() => ({}));
  await connectToDatabase();
  const workspace = await Workspace.findById(current.workspace.id).lean();
  if (!workspace.inviteCode) return NextResponse.json({ error: "ابتدا یک کد دعوت بسازید." }, { status: 400 });

  const updated = await Workspace.findByIdAndUpdate(current.workspace.id, { $set: { inviteEnabled: Boolean(body.enabled) } }, { new: true }).lean();
  return NextResponse.json(view(updated));
}
