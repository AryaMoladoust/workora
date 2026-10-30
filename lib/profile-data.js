import mongoose from "mongoose";
import { connectToDatabase } from "./db";
import { completeness, getProfileDoc, serializeProfile } from "./profile";
import { hasPermission } from "./permissions";
import User from "../database/models/User";
import Membership from "../database/models/Membership";
import Project from "../database/models/Project";
import Task from "../database/models/Task";

// Everything the profile page needs about one user as seen by `current`. Returns null when that user is not
// an active member of the viewer's workspace.
export async function getProfilePage(current, userId) {
  if (!mongoose.isValidObjectId(userId)) return null;
  await connectToDatabase();
  const workspaceId = new mongoose.Types.ObjectId(current.workspace.id);
  const uid = new mongoose.Types.ObjectId(String(userId));
  const isSelf = String(userId) === current.user.id;

  const membership = await Membership.findOne({ workspaceId, userId: uid, isActive: true, status: { $ne: "pending" } }).lean();
  if (!membership) return null;

  const [user, doc, allProjects] = await Promise.all([
    User.findById(uid).select("firstName lastName email phone avatarUrl lastSeenAt").lean(),
    getProfileDoc(uid),
    Project.find({ workspaceId, memberIds: uid }).select("name status memberIds").lean(),
  ]);
  if (!user) return null;

  // Privacy: the counters only include projects the viewer may see - their own projects, or every project when
  // they manage projects. Otherwise "12 tasks / 3 projects" would reveal work in projects they are not part of.
  const seesAll = isSelf || hasPermission(current, "projects.manage");
  const projects = seesAll ? allProjects : allProjects.filter((p) => (p.memberIds || []).map(String).includes(current.user.id));
  const projectIds = projects.map((p) => p._id);
  const [doneTasks, openTasks] = projectIds.length
    ? await Promise.all([
        Task.countDocuments({ workspaceId, projectId: { $in: projectIds }, assigneeId: uid, status: "done" }),
        Task.countDocuments({ workspaceId, projectId: { $in: projectIds }, assigneeId: uid, status: { $ne: "done" } }),
      ])
    : [0, 0];

  const profile = serializeProfile(doc);
  // project names are only listed for projects the viewer also belongs to
  const shared = allProjects.filter((p) => isSelf || (p.memberIds || []).map(String).includes(current.user.id));
  return {
    isSelf,
    user: {
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl || null,
      email: isSelf ? user.email : "",
      phone: isSelf ? user.phone || "" : "",
    },
    role: membership.role,
    joinedAt: membership.joinedAt ? new Date(membership.joinedAt).toISOString() : null,
    profile,
    completeness: completeness(profile, Boolean(user.avatarUrl)),
    stats: {
      projects: projects.length,
      doneTasks,
      openTasks,
      sharedProjects: shared.filter((p) => p.status !== "archived").slice(0, 8).map((p) => ({ id: String(p._id), name: p.name })),
    },
  };
}

// Light version for the dashboard card and the first-login redirect.
export async function getMyProfileSummary(current) {
  await connectToDatabase();
  const [doc, user] = await Promise.all([getProfileDoc(current.user.id), User.findById(current.user.id).select("avatarUrl").lean()]);
  const profile = serializeProfile(doc);
  return { profile, completeness: completeness(profile, Boolean(user?.avatarUrl)), avatarUrl: user?.avatarUrl || null };
}
