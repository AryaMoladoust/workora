import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { avatarPath } from "../../../../lib/profile";
import User from "../../../../database/models/User";
import UserAvatar from "../../../../database/models/UserAvatar";
import { limitUser } from "../../../../lib/user-limit";

export const runtime = "nodejs";

const MAX_BYTES = 200 * 1024; // the browser shrinks the photo to ~320px first, so real uploads are far smaller

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// POST { dataUrl: "data:image/jpeg;base64,..." } – set my profile photo.
export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const limited = await limitUser(current, "avatar");
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.dataUrl || ""));
  if (!match) return bad("فرمت عکس پشتیبانی نمی‌شود (JPG، PNG یا WebP).");
  const data = Buffer.from(match[2], "base64");
  if (!data.length) return bad("عکس خالی است.");
  if (data.length > MAX_BYTES) return bad("حجم عکس زیاد است. عکس کوچک‌تری انتخاب کنید.");

  // magic bytes: the declared type must match the content
  const head = data.subarray(0, 12);
  const isJpeg = head[0] === 0xff && head[1] === 0xd8;
  const isPng = head[0] === 0x89 && head.subarray(1, 4).toString("latin1") === "PNG";
  const isWebp = head.subarray(0, 4).toString("latin1") === "RIFF" && head.subarray(8, 12).toString("latin1") === "WEBP";
  const ok = (match[1] === "image/jpeg" && isJpeg) || (match[1] === "image/png" && isPng) || (match[1] === "image/webp" && isWebp);
  if (!ok) return bad("فایل عکس معتبر نیست.");

  await connectToDatabase();
  const saved = await UserAvatar.findOneAndUpdate(
    { userId: current.user.id },
    { $set: { contentType: match[1], data } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  const avatarUrl = avatarPath(current.user.id, saved.updatedAt);
  await User.updateOne({ _id: current.user.id }, { $set: { avatarUrl } });
  return NextResponse.json({ ok: true, avatarUrl });
}

export async function DELETE() {
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const limited = await limitUser(current, "avatar");
  if (limited) return limited;
  await connectToDatabase();
  await UserAvatar.deleteOne({ userId: current.user.id });
  await User.updateOne({ _id: current.user.id }, { $set: { avatarUrl: null } });
  return NextResponse.json({ ok: true, avatarUrl: null });
}
