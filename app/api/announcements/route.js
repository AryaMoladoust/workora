import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { canPostAnnouncements, serializeAnnouncement } from "../../../lib/announcements";
import { actorNameOf, notify } from "../../../lib/activity";
import Announcement from "../../../database/models/Announcement";
import Membership from "../../../database/models/Membership";

export const runtime = "nodejs";

export async function GET() {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  await connectToDatabase();
  const items = await Announcement.find({ workspaceId: current.workspace.id }).sort({ pinned: -1, createdAt: -1 }).limit(100).lean();
  return NextResponse.json({ announcements: items.map((a) => serializeAnnouncement(a, current)) });
}

export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  if (!canPostAnnouncements(current)) return NextResponse.json({ error: "اجازه انتشار اطلاعیه ندارید." }, { status: 403 });

  try {
    const body = await request.json().catch(() => ({}));
    const title = String(body.title || "").trim();
    const text = String(body.body || "").trim();
    if (title.length < 2 || title.length > 200) return NextResponse.json({ error: "عنوان باید بین ۲ تا ۲۰۰ کاراکتر باشد." }, { status: 400 });
    if (text.length < 1 || text.length > 10000) return NextResponse.json({ error: "متن اطلاعیه نامعتبر است." }, { status: 400 });

    await connectToDatabase();
    const announcement = await Announcement.create({
      workspaceId: current.workspace.id,
      authorId: current.user.id,
      authorName: actorNameOf(current),
      title,
      body: text,
      pinned: Boolean(body.pinned),
    });

    const members = await Membership.find({ workspaceId: current.workspace.id, isActive: true }).select("userId").lean();
    await notify(current, members.map((m) => m.userId), {
      type: "announcement.created",
      entityType: "announcement",
      entityId: announcement._id,
      entityTitle: title,
    });

    return NextResponse.json({ announcement: serializeAnnouncement(announcement.toObject(), current) }, { status: 201 });
  } catch (error) {
    console.error("ANNOUNCEMENT_CREATE_ERROR", error);
    return NextResponse.json({ error: "انتشار اطلاعیه انجام نشد." }, { status: 500 });
  }
}
