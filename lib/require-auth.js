import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";

// Cached per request so the root layout and the page share one lookup.
export const getCachedCurrentUser = cache(async () => getCurrentUser());

export async function requireAuth() {
  const current = await getCachedCurrentUser();
  if (!current) redirect("/login");
  return current;
}
