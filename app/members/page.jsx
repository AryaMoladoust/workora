import mongoose from "mongoose";
import { requireAuth } from "../../lib/require-auth";
import { connectToDatabase } from "../../lib/db";
import { hasPermission, isOwner, PERMISSION_IDS } from "../../lib/permissions";
import { listPendingRequests, listWorkspaceMembers } from "../../lib/members";
import { signupDomainHint } from "../../lib/signup";
import { dateTime, fa } from "../../lib/format";
import Project from "../../database/models/Project";
import MembersManager from "../../components/members/MembersManager";
import SignupRequests from "../../components/members/SignupRequests";
import Workspace from "../../database/models/Workspace";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const current = await requireAuth();
  const canManage = hasPermission(current, "members.manage");

  const members = await listWorkspaceMembers(current.workspace.id, { includeInactive: canManage });

  await connectToDatabase();
  const countRows = await Project.aggregate([
    { $match: { workspaceId: new mongoose.Types.ObjectId(current.workspace.id) } },
    { $unwind: "$memberIds" },
    { $group: { _id: "$memberIds", count: { $sum: 1 } } },
  ]);
  const projectCounts = new Map(countRows.map((r) => [String(r._id), r.count]));

  const prepared = members.map((m) => ({
    ...m,
    permissions: canManage ? m.permissions : [],
    phone: canManage ? m.phone : "",
    lastLoginText: canManage && m.lastLoginAt ? dateTime(m.lastLoginAt) : "",
    projectCount: projectCounts.get(m.userId) || 0,
  }));

  // a manager can only hand out permissions they hold themselves
  const grantable = isOwner(current) ? PERMISSION_IDS : PERMISSION_IDS.filter((id) => hasPermission(current, id));
  const activeCount = prepared.filter((m) => m.isActive).length;

  let requests = [];
  let signupEnabled = true;
  if (canManage) {
    requests = await listPendingRequests(current.workspace.id);
    const workspace = await Workspace.findById(current.workspace.id).select("signupRequestsEnabled").lean();
    signupEnabled = workspace?.signupRequestsEnabled !== false;
  }

  return (
    <div className="page-shell">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">Members</span>
          <h1>اعضا</h1>
          <p>{fa(activeCount)} عضو فعال در «{current.workspace.name}»</p>
        </div>
      </div>
      {canManage && <SignupRequests initialEnabled={signupEnabled} requests={requests} domainHint={signupDomainHint()} />}
      <MembersManager members={prepared} canManage={canManage} currentUserId={current.user.id} grantable={grantable} />
    </div>
  );
}
