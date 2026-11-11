import crypto from "node:crypto";
import mongoose from "mongoose";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectToDatabase } from "./db";
import { relativeTime } from "./format";
import { filterActiveMemberIds } from "./members";
import { PRESET_KEYS, VAULT_PRESETS } from "./vault-presets";
import Secret, { SECRET_SCOPES } from "../database/models/Secret";
import User from "../database/models/User";
import Membership from "../database/models/Membership";

/* ------------------------------------------------------------------ encryption (AES-256-GCM) */
// Passwords and notes are encrypted before they reach the database. The key comes from VAULT_KEY (recommended,
// separate from the session secret) or, when it is not set, from AUTH_SECRET.
// IMPORTANT: if that value is ever changed, the saved passwords can no longer be decrypted.
function encryptionKey() {
  const base = process.env.VAULT_KEY || process.env.AUTH_SECRET;
  if (!base || base.length < 32) throw new Error("VAULT_KEY or AUTH_SECRET (at least 32 characters) is required.");
  return crypto.createHash("sha256").update(`workora-vault-v1:${base}`).digest();
}

export function encryptText(plain) {
  const text = String(plain ?? "");
  if (!text) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

// Returns the text, "" for an empty value, or null when it cannot be decrypted.
export function decryptText(stored) {
  if (!stored) return "";
  try {
    const [version, iv, tag, data] = String(stored).split(".");
    if (version !== "v1" || !iv || !tag || !data) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ the lock (extra password gate) */
const VAULT_COOKIE = "workora_vault";
const VAULT_MINUTES = 30;

function jwtSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters long.");
  return new TextEncoder().encode(value);
}

export async function openVault(current) {
  const token = await new SignJWT({ purpose: "vault", userId: current.user.id, workspaceId: current.workspace.id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${VAULT_MINUTES}m`)
    .sign(jwtSecret());
  const store = await cookies();
  store.set(VAULT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: VAULT_MINUTES * 60,
  });
}

export async function closeVault() {
  const store = await cookies();
  store.delete(VAULT_COOKIE);
}

export async function isVaultOpen(current) {
  try {
    const store = await cookies();
    const token = store.get(VAULT_COOKIE)?.value;
    if (!token) return false;
    const { payload } = await jwtVerify(token, jwtSecret(), { algorithms: ["HS256"] });
    return payload.purpose === "vault" && String(payload.userId) === current.user.id && String(payload.workspaceId) === current.workspace.id;
  } catch {
    return false;
  }
}

// Returns null when the vault is open, otherwise a ready 423 response for the route to return.
export async function vaultGuard(current) {
  if (await isVaultOpen(current)) return null;
  return NextResponse.json({ error: "بخش رمزها قفل است. دوباره رمز ورک‌اورا را وارد کنید.", locked: true }, { status: 423 });
}

/* ------------------------------------------------------------------ access rules */
export function visibilityFilter(current) {
  return {
    workspaceId: current.workspace.id,
    $or: [{ ownerId: current.user.id }, { scope: "workspace" }, { scope: "users", sharedWith: current.user.id }],
  };
}

export function canEditSecret(current, secret) {
  return String(secret.ownerId) === current.user.id; // only the person who saved it (not even the workspace owner)
}

export async function findVisibleSecret(current, secretId) {
  if (!mongoose.isValidObjectId(secretId)) return null;
  await connectToDatabase();
  return Secret.findOne({ ...visibilityFilter(current), _id: secretId }).lean();
}

/* ------------------------------------------------------------------ serialization */
// List payloads NEVER contain the password or the note: they are only sent by the "reveal" route.
async function ownerNameMap(docs) {
  const ids = [...new Set(docs.map((d) => String(d.ownerId)))];
  const users = ids.length ? await User.find({ _id: { $in: ids } }).select("firstName lastName").lean() : [];
  return new Map(users.map((u) => [String(u._id), `${u.firstName} ${u.lastName}`]));
}

export async function serializeSecrets(current, docs, { full = false } = {}) {
  const names = await ownerNameMap(docs);
  return docs.map((s) => {
    const out = {
      id: String(s._id),
      title: s.title,
      username: s.username || "",
      url: s.url || "",
      scope: s.scope,
      sharedCount: (s.sharedWith || []).length,
      preset: s.preset || "",
      hasPassword: Boolean(s.password),
      ownerId: String(s.ownerId),
      ownerName: names.get(String(s.ownerId)) || "",
      canEdit: canEditSecret(current, s),
      updatedAt: new Date(s.updatedAt).toISOString(),
      updatedText: relativeTime(s.updatedAt),
    };
    if (full) {
      out.password = decryptText(s.password);
      out.note = decryptText(s.note);
      out.sharedWith = (s.sharedWith || []).map(String);
    }
    return out;
  });
}

// Suggested entries first (in their fixed order), then everything else newest first.
function sortSecrets(docs) {
  const rank = (d) => (d.preset ? PRESET_KEYS.indexOf(d.preset) : -1);
  return [...docs].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra >= 0 && rb >= 0) return ra - rb;
    if (ra >= 0) return -1;
    if (rb >= 0) return 1;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
}

export async function queryVault(current) {
  await connectToDatabase();
  const docs = await Secret.find(visibilityFilter(current)).sort({ updatedAt: -1 }).limit(500).lean();
  return serializeSecrets(current, sortSecrets(docs));
}

/* ------------------------------------------------------------------ suggested entries */
function presetDocs(current, keys) {
  return VAULT_PRESETS.filter((p) => keys.includes(p.key)).map((p) => ({
    workspaceId: current.workspace.id,
    ownerId: current.user.id,
    lastEditedBy: current.user.id,
    title: p.title,
    url: p.url,
    preset: p.key,
    scope: "private",
  }));
}

// First visit of a member: create the empty suggested entries. Done once per member (a deleted entry stays deleted).
export async function seedPresetsOnce(current) {
  await connectToDatabase();
  const flipped = await Membership.findOneAndUpdate({ _id: current.membership.id, vaultSeeded: { $ne: true } }, { $set: { vaultSeeded: true } });
  if (!flipped) return;
  await Secret.insertMany(presetDocs(current, PRESET_KEYS));
}

// "Add the suggestions again": only the ones this member does not have right now.
export async function restorePresets(current) {
  await connectToDatabase();
  const have = await Secret.find({ workspaceId: current.workspace.id, ownerId: current.user.id, preset: { $in: PRESET_KEYS } }).select("preset").lean();
  const haveKeys = new Set(have.map((s) => s.preset));
  const missing = PRESET_KEYS.filter((k) => !haveKeys.has(k));
  if (!missing.length) return [];
  return Secret.insertMany(presetDocs(current, missing));
}

/* ------------------------------------------------------------------ validation */
export async function parseSecretPayload(current, body, { partial = false, existing = null } = {}) {
  const data = {};

  if (!partial || body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (title.length < 1 || title.length > 200) return { error: "عنوان باید بین ۱ تا ۲۰۰ کاراکتر باشد." };
    data.title = title;
  }
  if (body.username !== undefined) {
    const username = String(body.username || "").trim();
    if (username.length > 200) return { error: "نام کاربری بیش از حد طولانی است." };
    data.username = username;
  }
  if (body.url !== undefined) {
    let url = String(body.url || "").trim();
    if (url) {
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad");
      } catch {
        return { error: "آدرس سایت معتبر نیست." };
      }
      if (url.length > 500) return { error: "آدرس سایت بیش از حد طولانی است." };
    }
    data.url = url;
  }
  if (body.password !== undefined) {
    const password = String(body.password ?? "");
    if (password.length > 2000) return { error: "رمز بیش از حد طولانی است (حداکثر ۲۰۰۰ کاراکتر)." };
    data.password = encryptText(password);
  }
  if (body.note !== undefined) {
    const note = String(body.note ?? "");
    if (note.length > 5000) return { error: "توضیحات بیش از حد طولانی است (حداکثر ۵۰۰۰ کاراکتر)." };
    data.note = encryptText(note);
  }

  if (!partial || body.scope !== undefined || body.sharedWith !== undefined) {
    const scope = body.scope ?? existing?.scope ?? "private";
    if (!SECRET_SCOPES.includes(scope)) return { error: "محدوده‌ی اشتراک نامعتبر است." };
    data.scope = scope;
    if (scope === "users") {
      const wanted = Array.isArray(body.sharedWith) ? body.sharedWith : (existing?.sharedWith || []).map(String);
      const ids = (await filterActiveMemberIds(current.workspace.id, wanted)).map(String).filter((id) => id !== current.user.id);
      if (ids.length === 0) return { error: "حداقل یک نفر را برای مشاهده انتخاب کنید." };
      data.sharedWith = ids;
    } else {
      data.sharedWith = [];
    }
  }
  return { data };
}
