import { createFileRoute } from '@tanstack/react-router';
import { JobState, ProjectJobs } from '../features/jobs';
function Jobs() {
  const { projectId } = Route.useParams();
  const { jobId } = Route.useSearch();
  const navigate = Route.useNavigate();
  return jobId ? <JobState projectId={projectId} jobId={jobId} onRetry={job => void navigate({ search: { jobId: job.id } })} /> : <ProjectJobs projectId={projectId} />;
}
export const Route = createFileRoute('/projects/$projectId/jobs')({
  validateSearch: (search: Record<string, unknown>): { jobId?: string } => typeof search.jobId === 'string' ? { jobId: search.jobId } : {},
  component: Jobs,
});
