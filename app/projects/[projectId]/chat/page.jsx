import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "../../../../lib/require-auth";
import { getProjectForPage } from "../../../../lib/project-access";
import { openProjectConversation } from "../../../../lib/chat";
import ChatThread from "../../../../components/chat/ChatThread";

export const dynamic = "force-dynamic";

export default async function ProjectChatPage({ params }) {
  params = await params;
  const current = await requireAuth();
  const project = await getProjectForPage(current, params.projectId);
  if (!project) notFound();

  const result = await openProjectConversation(current, String(project._id));
  if (result.error) {
    return (
      <div className="empty-state">
        <h2>چت این پروژه در دسترس نیست</h2>
        <p>{result.error} از تب «اعضا» می‌توانید خودتان را به پروژه اضافه کنید.</p>
        <Link className="secondary-button" href={`/projects/${project._id}/members`}>رفتن به اعضا</Link>
      </div>
    );
  }

  return (
    <ChatThread
      embedded
      conversation={{ id: String(result.conversation._id), kind: "project", title: project.name, projectId: String(project._id) }}
      me={{ id: current.user.id, name: `${current.user.firstName} ${current.user.lastName}` }}
    />
  );
}
