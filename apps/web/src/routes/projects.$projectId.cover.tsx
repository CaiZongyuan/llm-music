import { createFileRoute } from '@tanstack/react-router';
import { Cover, type CoverRouteSelection } from '../features/cover/Cover';

function ProjectCover() {
  const { projectId } = Route.useParams(), selection = Route.useSearch(), navigate = Route.useNavigate();
  return <Cover key={projectId} projectId={projectId} selection={selection} onSelect={value => void navigate({ search: value, replace: true })} />;
}
export const Route = createFileRoute('/projects/$projectId/cover')({
  validateSearch: (search: Record<string, unknown>): CoverRouteSelection => ({
    referenceAssetId: typeof search.referenceAssetId === 'string' ? search.referenceAssetId : undefined,
    transcriptionJobId: typeof search.transcriptionJobId === 'string' ? search.transcriptionJobId : undefined,
    scoreId: typeof search.scoreId === 'string' ? search.scoreId : undefined,
    jobId: typeof search.jobId === 'string' ? search.jobId : undefined,
  }), component: ProjectCover,
});
