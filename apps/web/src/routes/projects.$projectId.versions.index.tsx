import { createFileRoute } from '@tanstack/react-router';
import { Versions } from '../features/versions/Versions';

export const Route = createFileRoute('/projects/$projectId/versions/')({ component: VersionsRoute });
function VersionsRoute() { const { projectId } = Route.useParams(); return <Versions projectId={projectId} />; }
