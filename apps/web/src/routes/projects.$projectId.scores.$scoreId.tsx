import { createFileRoute } from '@tanstack/react-router';
import { ScoreReader } from '../features/scores/ScoreReader';

function ProjectScore() { const { projectId, scoreId } = Route.useParams(); const { branchVersionId } = Route.useSearch(); return <ScoreReader projectId={projectId} scoreId={scoreId} branchVersionId={branchVersionId} />; }
export const Route = createFileRoute('/projects/$projectId/scores/$scoreId')({
  validateSearch: (search: Record<string, unknown>): { jobId?: string; branchVersionId?: string } => ({
    ...(typeof search.jobId === 'string' ? { jobId: search.jobId } : {}),
    ...(Object.hasOwn(search, 'branchVersionId') ? { branchVersionId: typeof search.branchVersionId === 'string' ? search.branchVersionId : '' } : {}),
  }), component: ProjectScore,
});
