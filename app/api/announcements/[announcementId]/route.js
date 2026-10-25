import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { canPostAnnouncements, serializeAnnouncement } from "../../../../lib/announcements";
import Announcement from "../../../../database/models/Announcement";
import { limitUser } from "../../../../lib/user-limit";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function load(current, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  await connectToDatabase();
  return Announcement.findOne({ _id: id, workspaceId: current.workspace.id }).lean();
}

export async function PATCH(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const limited = await limitUser(current, "announce");
  if (limited) return limited;
  if (!canPostAnnouncements(current)) return bad("اجازه ویرایش اطلاعیه ندارید.", 403);

  const existing = await load(current, params.announcementId);
  if (!existing) return bad("اطلاعیه پیدا نشد.", 404);

  const body = await request.json().catch(() => ({}));
  const update = {};
  if (body.title !== undefined) {
    update.title = String(body.title).trim();
    if (update.title.length < 2 || update.title.length > 200) return bad("عنوان باید بین ۲ تا ۲۰۰ کاراکتر باشد.");
  }
  if (body.body !== undefined) {
    update.body = String(body.body).trim();
    if (update.body.length < 1 || update.body.length > 10000) return bad("متن اطلاعیه نامعتبر است.");
  }
  if (body.pinned !== undefined) update.pinned = Boolean(body.pinned);

  const announcement = await Announcement.findByIdAndUpdate(existing._id, { $set: update }, { new: true, runValidators: true }).lean();
  return NextResponse.json({ announcement: serializeAnnouncement(announcement, current) });
}

export async function DELETE(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const limited = await limitUser(current, "announce");
  if (limited) return limited;
  if (!canPostAnnouncements(current)) return bad("اجازه حذف اطلاعیه ندارید.", 403);

  const existing = await load(current, params.announcementId);
  if (!existing) return bad("اطلاعیه پیدا نشد.", 404);
  await Announcement.deleteOne({ _id: existing._id });
  return NextResponse.json({ ok: true });
}
