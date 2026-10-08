import { createFileRoute } from '@tanstack/react-router';
import { Version } from '../features/versions/Version';

export const Route = createFileRoute('/projects/$projectId/versions/$versionId')({ component: VersionRoute });
function VersionRoute() { const { projectId, versionId } = Route.useParams(); return <Version projectId={projectId} versionId={versionId} />; }
