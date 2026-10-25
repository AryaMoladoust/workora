import mongoose from "mongoose";
import { connectToDatabase } from "./db";
import User from "../database/models/User";
import Membership from "../database/models/Membership";

export function serializeMember(membership, user) {
  return {
    membershipId: String(membership._id),
    userId: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone || "",
    avatarUrl: user.avatarUrl || null,
    role: membership.role,
    permissions: membership.permissions || [],
    isActive: membership.isActive,
    joinedAt: membership.joinedAt ? new Date(membership.joinedAt).toISOString() : null,
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
  };
}

export async function listWorkspaceMembers(workspaceId, { includeInactive = false } = {}) {
  await connectToDatabase();
  const filter = { workspaceId, status: { $ne: "pending" } }; // pending sign-ups are listed separately
  if (!includeInactive) filter.isActive = true;
  const memberships = await Membership.find(filter).sort({ role: -1, joinedAt: 1 }).lean();
  const users = await User.find({ _id: { $in: memberships.map((m) => m.userId) } })
    .select("firstName lastName email phone lastLoginAt avatarUrl")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return memberships
    .map((m) => {
      const user = byId.get(String(m.userId));
      return user ? serializeMember(m, user) : null;
    })
    .filter(Boolean);
}

// Sign-up requests waiting for approval (oldest first).
export async function listPendingRequests(workspaceId) {
  await connectToDatabase();
  const rows = await Membership.find({ workspaceId, status: "pending" }).sort({ createdAt: 1 }).lean();
  const users = await User.find({ _id: { $in: rows.map((m) => m.userId) } }).select("firstName lastName email").lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return rows
    .map((m) => {
      const u = byId.get(String(m.userId));
      return u
        ? { membershipId: String(m._id), userId: String(u._id), firstName: u.firstName, lastName: u.lastName, email: u.email, requestedAt: new Date(m.createdAt).toISOString() }
        : null;
    })
    .filter(Boolean);
}

// Returns only the ids that belong to active members of the workspace.
export async function filterActiveMemberIds(workspaceId, ids) {
  const valid = [...new Set((Array.isArray(ids) ? ids : []).map(String))].filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return [];
  await connectToDatabase();
  const rows = await Membership.find({ workspaceId, isActive: true, userId: { $in: valid } }).select("userId").lean();
  return rows.map((r) => String(r.userId));
}
