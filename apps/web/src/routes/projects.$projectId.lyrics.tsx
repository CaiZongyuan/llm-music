import { createFileRoute } from '@tanstack/react-router';
import { Lyrics } from '../features/generation/Lyrics';

export const Route = createFileRoute('/projects/$projectId/lyrics')({ component: LyricsRoute });
function LyricsRoute() { const { projectId } = Route.useParams(); return <Lyrics projectId={projectId} />; }
