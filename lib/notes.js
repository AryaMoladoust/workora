import mongoose from "mongoose";
import { connectToDatabase } from "./db";
import { isOwner } from "./permissions";
import { relativeTime } from "./format";
import Note, { NOTE_KINDS, NOTE_SCOPES } from "../database/models/Note";
import Project from "../database/models/Project";
import User from "../database/models/User";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Projects the user is a member of (project-scoped notes are visible to those members only).
export async function memberProjects(current) {
  await connectToDatabase();
  return Project.find({ workspaceId: current.workspace.id, memberIds: current.user.id })
    .select("name status")
    .sort({ name: 1 })
    .lean();
}

export async function visibilityFilter(current) {
  const projects = await memberProjects(current);
  return {
    workspaceId: current.workspace.id,
    $or: [
      { ownerId: current.user.id },
      { scope: "workspace" },
      { scope: "project", projectId: { $in: projects.map((p) => p._id) } },
    ],
  };
}

export function canEditNote(current, note) {
  if (String(note.ownerId) === current.user.id) return true;
  return isOwner(current) && note.scope !== "private"; // workspace owner can moderate shared items
}

export function cleanTags(input) {
  const raw = Array.isArray(input) ? input : String(input || "").split(/[,،\n]/);
  return [...new Set(raw.map((t) => String(t).trim().slice(0, 30)).filter(Boolean))].slice(0, 10);
}

export function serializeNote(note, { projectNames, ownerNames, withBody = false, current } = {}) {
  const body = note.body || "";
  const out = {
    id: String(note._id),
    kind: note.kind,
    title: note.title,
    tags: note.tags || [],
    scope: note.scope,
    projectId: note.projectId ? String(note.projectId) : null,
    projectName: note.projectId ? projectNames?.get(String(note.projectId)) || "" : "",
    ownerId: String(note.ownerId),
    ownerName: ownerNames?.get(String(note.ownerId)) || "",
    pinned: Boolean(note.pinned),
    updatedAt: new Date(note.updatedAt).toISOString(),
    updatedText: relativeTime(note.updatedAt),
    size: Buffer.byteLength(body, "utf8"),
    // configs may contain credentials: never put their content in list payloads
    snippet: note.kind === "note" ? body.replace(/\s+/g, " ").slice(0, 200) : "",
    canEdit: current ? canEditNote(current, note) : false,
  };
  if (withBody) out.body = body;
  return out;
}

async function nameMaps(notes) {
  const projectIds = [...new Set(notes.map((n) => n.projectId).filter(Boolean).map(String))];
  const ownerIds = [...new Set(notes.map((n) => String(n.ownerId)))];
  const [projects, users] = await Promise.all([
    projectIds.length ? Project.find({ _id: { $in: projectIds } }).select("name").lean() : [],
    ownerIds.length ? User.find({ _id: { $in: ownerIds } }).select("firstName lastName").lean() : [],
  ]);
  return {
    projectNames: new Map(projects.map((p) => [String(p._id), p.name])),
    ownerNames: new Map(users.map((u) => [String(u._id), `${u.firstName} ${u.lastName}`])),
  };
}

export async function queryNotes(current, { kind, q = "", scope = "" }) {
  await connectToDatabase();
  const filter = await visibilityFilter(current);
  const and = [{ kind }];
  if (scope === "private") and.push({ ownerId: current.user.id, scope: "private" });
  else if (scope === "shared") and.push({ scope: { $in: ["workspace", "project"] } });
  const needle = String(q).trim().slice(0, 80);
  if (needle) {
    const rx = new RegExp(escapeRegex(needle), "i");
    and.push({ $or: [{ title: rx }, { body: rx }, { tags: rx }] });
  }
  const notes = await Note.find({ ...filter, $and: and })
    .select("-body")
    .sort({ pinned: -1, updatedAt: -1 })
    .limit(300)
    .lean();

  // snippets for notes need the body: fetch a short prefix only
  let withSnippets = notes;
  if (kind === "note" && notes.length) {
    const rows = await Note.aggregate([
      { $match: { _id: { $in: notes.map((n) => n._id) } } },
      { $project: { body: { $substrCP: [{ $ifNull: ["$body", ""] }, 0, 200] }, size: { $strLenBytes: { $ifNull: ["$body", ""] } } } },
    ]);
    const byId = new Map(rows.map((r) => [String(r._id), r]));
    withSnippets = notes.map((n) => ({ ...n, body: byId.get(String(n._id))?.body || "", __size: byId.get(String(n._id))?.size || 0 }));
  } else {
    const rows = notes.length
      ? await Note.aggregate([{ $match: { _id: { $in: notes.map((n) => n._id) } } }, { $project: { size: { $strLenBytes: { $ifNull: ["$body", ""] } } } }])
      : [];
    const byId = new Map(rows.map((r) => [String(r._id), r.size]));
    withSnippets = notes.map((n) => ({ ...n, __size: byId.get(String(n._id)) || 0 }));
  }

  const maps = await nameMaps(withSnippets);
  return withSnippets.map((n) => {
    const item = serializeNote(n, { ...maps, current });
    item.size = n.__size ?? item.size;
    return item;
  });
}

export async function findVisibleNote(current, noteId) {
  if (!mongoose.isValidObjectId(noteId)) return null;
  await connectToDatabase();
  const filter = await visibilityFilter(current);
  return Note.findOne({ ...filter, _id: noteId }).lean();
}

export async function serializeFull(current, note) {
  const maps = await nameMaps([note]);
  return serializeNote(note, { ...maps, withBody: true, current });
}

// Validates a create/update payload. Returns { error } or { data }.
export async function parseNotePayload(current, body, { partial = false, existing = null } = {}) {
  const data = {};
  if (!partial || body.title !== undefined) {
    const title = String(body.title || "").trim();
    if (title.length < 1 || title.length > 200) return { error: "عنوان باید بین ۱ تا ۲۰۰ کاراکتر باشد." };
    data.title = title;
  }
  if (!partial || body.body !== undefined) {
    const text = String(body.body ?? "");
    if (text.length > 200000) return { error: "متن بیش از حد طولانی است (حداکثر ۲۰۰ هزار کاراکتر)." };
    data.body = text;
  }
  if (body.tags !== undefined) data.tags = cleanTags(body.tags);
  if (body.pinned !== undefined) data.pinned = Boolean(body.pinned);

  if (!partial || body.scope !== undefined || body.projectId !== undefined) {
    const scope = body.scope ?? existing?.scope ?? "private";
    if (!NOTE_SCOPES.includes(scope)) return { error: "محدوده‌ی اشتراک نامعتبر است." };
    data.scope = scope;
    if (scope === "project") {
      const projectId = body.projectId ?? existing?.projectId;
      if (!projectId || !mongoose.isValidObjectId(projectId)) return { error: "یک پروژه انتخاب کنید." };
      const projects = await memberProjects(current);
      if (!projects.some((p) => String(p._id) === String(projectId))) return { error: "فقط برای پروژه‌هایی که عضوشان هستید می‌توانید به‌اشتراک بگذارید." };
      data.projectId = projectId;
    } else {
      data.projectId = null;
    }
  }
  return { data };
}

export { NOTE_KINDS };
