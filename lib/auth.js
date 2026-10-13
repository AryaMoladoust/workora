import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { connectToDatabase } from "./db";
import User from "../database/models/User";
import Membership from "../database/models/Membership";
import Workspace from "../database/models/Workspace";

const COOKIE_NAME = "workora_session";
const SESSION_DAYS = 7;

function getSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET must be at least 32 characters long.");
  }
  return new TextEncoder().encode(value);
}

export async function createSession({ userId, workspaceId, membershipId }) {
  const token = await new SignJWT({ userId, workspaceId, membershipId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(getSecret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession() {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ["HS256"],
    });

    if (!payload.userId || !payload.workspaceId || !payload.membershipId) {
      return null;
    }

    return {
      userId: String(payload.userId),
      workspaceId: String(payload.workspaceId),
      membershipId: String(payload.membershipId),
    };
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;

  await connectToDatabase();
  // three independent lookups in parallel (one network round trip to the database)
  const [membership, user, workspace] = await Promise.all([
    Membership.findOne({
      _id: session.membershipId,
      userId: session.userId,
      workspaceId: session.workspaceId,
      isActive: true,
    }).lean(),
    User.findOne({ _id: session.userId, isActive: true }).lean(),
    Workspace.findOne({ _id: session.workspaceId, isActive: true }).lean(),
  ]);

  if (!membership || !user || !workspace) return null;

  return {
    user: {
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
    workspace: {
      id: String(workspace._id),
      name: workspace.name,
      slug: workspace.slug,
    },
    membership: {
      id: String(membership._id),
      role: membership.role,
      permissions: membership.permissions,
    },
  };
}

export { COOKIE_NAME };
