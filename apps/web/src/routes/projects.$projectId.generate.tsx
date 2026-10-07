import { createFileRoute } from '@tanstack/react-router';
import { Generate } from '../features/generation/Generate';

export const Route = createFileRoute('/projects/$projectId/generate')({
  validateSearch: (search: Record<string, unknown>): { jobId?: string; candidateId?: string } => ({
    ...(typeof search.jobId === 'string' ? { jobId: search.jobId } : {}),
    ...(typeof search.candidateId === 'string' ? { candidateId: search.candidateId } : {}),
  }),
  component: GenerateRoute,
});
function GenerateRoute() { const { projectId } = Route.useParams(); return <Generate projectId={projectId} search={Route.useSearch()} />; }
