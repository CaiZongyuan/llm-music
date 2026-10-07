import { createFileRoute } from '@tanstack/react-router';
import { ScoreReader } from '../features/scores/ScoreReader';

function ProjectScore() { const { projectId, scoreId } = Route.useParams(); return <ScoreReader key={`${projectId}/${scoreId}`} projectId={projectId} scoreId={scoreId} />; }
export const Route = createFileRoute('/projects/$projectId/scores/$scoreId')({ component: ProjectScore });
