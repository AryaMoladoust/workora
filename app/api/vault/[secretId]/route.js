import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { limitUser } from "../../../../lib/user-limit";
import { canEditSecret, decryptText, findVisibleSecret, parseSecretPayload, serializeSecrets, vaultGuard } from "../../../../lib/vault";
import Secret from "../../../../database/models/Secret";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

function bad(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: NO_STORE });
}

async function gate() {
  const current = await getCurrentUser();
  if (!current) return { response: bad("احراز هویت لازم است.", 401) };
  const locked = await vaultGuard(current);
  if (locked) return { response: locked };
  const limited = await limitUser(current, "vault");
  if (limited) return { response: limited };
  return { current };
}

// GET – open one entry INCLUDING its password and note (the only place they are ever sent).
export async function GET(_request, { params }) {
  params = await params;
  const { current, response } = await gate();
  if (response) return response;

  const secret = await findVisibleSecret(current, params.secretId);
  if (!secret) return bad("پیدا نشد.", 404);
  const [full] = await serializeSecrets(current, [secret], { full: true });
  if (full.password === null || full.note === null) {
    return bad("این رمز قابل خواندن نیست (کلید رمزنگاری سرور تغییر کرده است).", 500);
  }
  return NextResponse.json({ secret: full }, { headers: NO_STORE });
}

export async function PATCH(request, { params }) {
  params = await params;
  const { current, response } = await gate();
  if (response) return response;

  const existing = await findVisibleSecret(current, params.secretId);
  if (!existing) return bad("پیدا نشد.", 404);
  if (!canEditSecret(current, existing)) return bad("فقط سازنده می‌تواند این رمز را ویرایش کند.", 403);

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = await parseSecretPayload(current, body, { partial: true, existing });
    if (parsed.error) return bad(parsed.error);

    await connectToDatabase();
    const doc = await Secret.findByIdAndUpdate(existing._id, { $set: { ...parsed.data, lastEditedBy: current.user.id } }, { new: true, runValidators: true }).lean();
    const [secret] = await serializeSecrets(current, [doc]);
    return NextResponse.json({ secret }, { headers: NO_STORE });
  } catch (error) {
    console.error("VAULT_UPDATE_ERROR", error);
    return bad("ذخیره انجام نشد.", 500);
  }
}

export async function DELETE(_request, { params }) {
  params = await params;
  const { current, response } = await gate();
  if (response) return response;

  const existing = await findVisibleSecret(current, params.secretId);
  if (!existing) return bad("پیدا نشد.", 404);
  if (!canEditSecret(current, existing)) return bad("فقط سازنده می‌تواند این رمز را حذف کند.", 403);

  await connectToDatabase();
  await Secret.deleteOne({ _id: existing._id });
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
