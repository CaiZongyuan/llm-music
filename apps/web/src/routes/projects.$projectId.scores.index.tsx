import { createFileRoute } from '@tanstack/react-router';
import { Scores } from '../features/scores/Scores';

function ProjectScores() { const { projectId } = Route.useParams(); return <Scores key={projectId} projectId={projectId} />; }
export const Route = createFileRoute('/projects/$projectId/scores/')({ component: ProjectScores });
