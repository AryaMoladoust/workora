import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { limitUser } from "../../../lib/user-limit";
import { parseSecretPayload, serializeSecrets, vaultGuard } from "../../../lib/vault";
import Secret from "../../../database/models/Secret";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

// POST – save a new password entry.
export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const locked = await vaultGuard(current);
  if (locked) return locked;
  const limited = await limitUser(current, "vault");
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = await parseSecretPayload(current, body);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400, headers: NO_STORE });

    await connectToDatabase();
    const count = await Secret.countDocuments({ workspaceId: current.workspace.id, ownerId: current.user.id });
    if (count >= 300) return NextResponse.json({ error: "حداکثر ۳۰۰ رمز می‌توانید ذخیره کنید." }, { status: 400, headers: NO_STORE });

    const doc = await Secret.create({ workspaceId: current.workspace.id, ownerId: current.user.id, lastEditedBy: current.user.id, ...parsed.data });
    const [secret] = await serializeSecrets(current, [doc.toObject()]);
    return NextResponse.json({ secret }, { status: 201, headers: NO_STORE });
  } catch (error) {
    console.error("VAULT_CREATE_ERROR", error);
    return NextResponse.json({ error: "ذخیره انجام نشد." }, { status: 500, headers: NO_STORE });
  }
}
