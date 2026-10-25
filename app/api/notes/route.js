import { NextResponse } from "next/server";
import { connectToDatabase } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { NOTE_KINDS, parseNotePayload, queryNotes, serializeFull } from "../../../lib/notes";
import Note from "../../../database/models/Note";
import { limitUser } from "../../../lib/user-limit";

export const runtime = "nodejs";

export async function GET(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  if (!NOTE_KINDS.includes(kind)) return NextResponse.json({ error: "نوع نامعتبر است." }, { status: 400 });

  const notes = await queryNotes(current, { kind, q: searchParams.get("q") || "", scope: searchParams.get("scope") || "" });
  return NextResponse.json({ notes });
}

export async function POST(request) {
  const current = await getCurrentUser();
  if (!current) return NextResponse.json({ error: "احراز هویت لازم است." }, { status: 401 });
  const limited = await limitUser(current, "note");
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    if (!NOTE_KINDS.includes(body.kind)) return NextResponse.json({ error: "نوع نامعتبر است." }, { status: 400 });

    const parsed = await parseNotePayload(current, body);
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

    await connectToDatabase();
    const note = await Note.create({
      workspaceId: current.workspace.id,
      kind: body.kind,
      ownerId: current.user.id,
      lastEditedBy: current.user.id,
      ...parsed.data,
    });
    return NextResponse.json({ note: await serializeFull(current, note.toObject()) }, { status: 201 });
  } catch (error) {
    console.error("NOTE_CREATE_ERROR", error);
    return NextResponse.json({ error: "ذخیره انجام نشد." }, { status: 500 });
  }
}
