import Link from "next/link";
import { Suspense } from "react";
import ProjectHead from "../../../components/projects/ProjectHead";
import { ProjectHeadSkeleton } from "../../../components/skeleton/pages";

export const dynamic = "force-dynamic";

// The layout itself does no database work: the header streams in separately and the page body
// (tab content) shows its own loading skeleton, so navigating into a project feels instant.
export default async function ProjectLayout({ children, params }) {
  params = await params;

  return (
    <div className="page-shell project-page">
      <Link href="/projects" className="back-link">← پروژه‌ها</Link>
      <Suspense fallback={<ProjectHeadSkeleton />}>
        <ProjectHead projectId={params.projectId} />
      </Suspense>
      <div className="project-body">{children}</div>
    </div>
  );
}
