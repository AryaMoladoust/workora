import { cache } from "react";
import mongoose from "mongoose";
import { connectToDatabase } from "./db";
import Project from "../database/models/Project";
import { hasPermission } from "./permissions";

// Owners and users with "projects.manage" see every project of the workspace.
// Everybody else only sees the projects they are a member of.
export function canViewAllProjects(current) {
  return hasPermission(current, "projects.manage");
}

export function projectScope(current) {
  const filter = { workspaceId: current.workspace.id };
  if (!canViewAllProjects(current)) filter.memberIds = current.user.id;
  return filter;
}

export async function findAccessibleProject(current, projectId) {
  if (!mongoose.isValidObjectId(projectId)) return null;
  await connectToDatabase();
  return Project.findOne({ _id: projectId, ...projectScope(current) }).lean();
}

export async function visibleProjectIds(current) {
  await connectToDatabase();
  const rows = await Project.find(projectScope(current)).select("_id").lean();
  return rows.map((r) => r._id);
}

// Per-request cache so a project layout and its pages share one lookup.
export const getProjectForPage = cache(async (current, projectId) => findAccessibleProject(current, projectId));
