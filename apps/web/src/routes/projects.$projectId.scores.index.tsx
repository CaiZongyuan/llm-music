import { createFileRoute } from '@tanstack/react-router';
import { Scores } from '../features/scores/Scores';

function ProjectScores() { const { projectId } = Route.useParams(); return <Scores key={projectId} projectId={projectId} />; }
export const Route = createFileRoute('/projects/$projectId/scores/')({ validateSearch: (search: Record<string, unknown>): { jobId?: string } => ({ ...(typeof search.jobId === 'string' ? { jobId: search.jobId } : {}) }), component: ProjectScores });
