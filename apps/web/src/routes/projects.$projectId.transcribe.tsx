import { createFileRoute } from '@tanstack/react-router';
import { Transcription, type TranscriptionSelection } from '../features/transcription/Transcription';

function ProjectTranscription() {
  const { projectId } = Route.useParams();
  const selection = Route.useSearch();
  const navigate = Route.useNavigate();
  return <Transcription key={projectId} projectId={projectId} selection={selection} onSelect={value => void navigate({ search: value, replace: true })} />;
}
export const Route = createFileRoute('/projects/$projectId/transcribe')({
  validateSearch: (search: Record<string, unknown>): TranscriptionSelection => ({
    referenceAssetId: typeof search.referenceAssetId === 'string' ? search.referenceAssetId : undefined,
    jobId: typeof search.jobId === 'string' ? search.jobId : undefined,
  }),
  component: ProjectTranscription,
});
