import { requireAuth } from "../../lib/require-auth";
import { listConversations } from "../../lib/chat";
import { listWorkspaceMembers } from "../../lib/members";
import ChatApp from "../../components/chat/ChatApp";

export const dynamic = "force-dynamic";

export default async function ChatPage({ searchParams }) {
  searchParams = await searchParams;
  const current = await requireAuth();

  const [lists, members] = await Promise.all([
    listConversations(current),
    listWorkspaceMembers(current.workspace.id),
  ]);

  const requested = typeof searchParams?.c === "string" ? searchParams.c : null;
  const exists = requested && [...lists.projects, ...lists.groups, ...lists.directs].some((c) => c.id === requested);

  return (
    <ChatApp
      me={{ id: current.user.id, name: `${current.user.firstName} ${current.user.lastName}` }}
      initialProjects={lists.projects}
      initialGroups={lists.groups}
      initialDirects={lists.directs}
      people={members
        .filter((m) => m.userId !== current.user.id)
        .map(({ userId, firstName, lastName }) => ({ userId, firstName, lastName }))}
      initialActiveId={exists ? requested : null}
    />
  );
}
