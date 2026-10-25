import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { canEditNote, findVisibleNote, parseNotePayload, serializeFull } from "../../../../lib/notes";
import Note from "../../../../database/models/Note";
import { limitUser } from "../../../../lib/user-limit";

export const runtime = "nodejs";

function bad(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const note = await findVisibleNote(current, params.noteId);
  if (!note) return bad("پیدا نشد.", 404);
  return NextResponse.json({ note: await serializeFull(current, note) });
}

export async function PATCH(request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const limited = await limitUser(current, "note");
  if (limited) return limited;

  const existing = await findVisibleNote(current, params.noteId);
  if (!existing) return bad("پیدا نشد.", 404);
  if (!canEditNote(current, existing)) return bad("اجازه ویرایش ندارید.", 403);

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = await parseNotePayload(current, body, { partial: true, existing });
    if (parsed.error) return bad(parsed.error);

    await connectToDatabase();
    const note = await Note.findByIdAndUpdate(
      existing._id,
      { $set: { ...parsed.data, lastEditedBy: current.user.id } },
      { new: true, runValidators: true }
    ).lean();
    return NextResponse.json({ note: await serializeFull(current, note) });
  } catch (error) {
    console.error("NOTE_UPDATE_ERROR", error);
    return bad("ذخیره انجام نشد.", 500);
  }
}

export async function DELETE(_request, { params }) {
  params = await params;
  const current = await getCurrentUser();
  if (!current) return bad("احراز هویت لازم است.", 401);
  const limited = await limitUser(current, "note");
  if (limited) return limited;

  const existing = await findVisibleNote(current, params.noteId);
  if (!existing) return bad("پیدا نشد.", 404);
  if (!canEditNote(current, existing)) return bad("اجازه حذف ندارید.", 403);

  await Note.deleteOne({ _id: existing._id });
  return NextResponse.json({ ok: true });
}
