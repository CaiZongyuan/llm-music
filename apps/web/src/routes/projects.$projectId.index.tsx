import { createFileRoute } from '@tanstack/react-router';
import { ReferenceAssets } from '../features/assets/ReferenceAssets';
import { ProjectJobs } from '../features/jobs';

function ProjectHome() {
  const { projectId } = Route.useParams();
  return <><ReferenceAssets key={projectId} projectId={projectId} /><ProjectJobs projectId={projectId} /></>;
}
export const Route = createFileRoute('/projects/$projectId/')({ component: ProjectHome });
