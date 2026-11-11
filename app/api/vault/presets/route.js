import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { limitUser } from "../../../../lib/user-limit";
import { restorePresets, serializeSecrets, vaultGuard } from "../../../../lib/vault";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

// POST – put back the suggested entries (GitHub, LinkedIn, ...) this member has deleted. Existing ones are untouched.
export async function POST() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const locked = await vaultGuard(current);
  if (locked) return locked;
  const limited = await limitUser(current, "vault");
  if (limited) return limited;

  try {
    const created = await restorePresets(current);
    const secrets = await serializeSecrets(current, created.map((d) => (d.toObject ? d.toObject() : d)));
    return NextResponse.json({ secrets }, { headers: NO_STORE });
  } catch (error) {
    console.error("VAULT_PRESETS_ERROR", error);
    return NextResponse.json({ error: "افزودن انجام نشد." }, { status: 500, headers: NO_STORE });
  }
}
