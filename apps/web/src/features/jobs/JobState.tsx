import { useQuery } from '@tanstack/react-query';
import { Loading, ErrorNotice } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { jobMessages } from './messages';
import { jobOptions, projectJobsOptions } from './queries';
import { JobStatus } from './JobStatus';

export function JobState({ projectId, jobId }: { projectId: string; jobId: string }) {
  const t = useMessages(jobMessages);
  const job = useQuery(jobOptions(projectId, jobId));
  if (job.isPending) return <Loading />;
  if (job.isError) return <ErrorNotice error={job.error} onRetry={() => void job.refetch()} />;
  return <><JobStatus job={job.data} /><button type="button" onClick={() => void job.refetch()}>{t.refresh}</button></>;
}
export function ProjectJobs({ projectId }: { projectId: string }) {
  const t = useMessages(jobMessages);
  const jobs = useQuery(projectJobsOptions(projectId));
  return <section className="surface jobs-summary"><div className="section-heading"><h2>{t.title}</h2><button type="button" onClick={() => void jobs.refetch()}>{t.refresh}</button></div>
    {jobs.isPending ? <Loading /> : jobs.isError ? <ErrorNotice error={jobs.error} onRetry={() => void jobs.refetch()} /> : jobs.data.length === 0
      ? <div className="empty"><h3>{t.empty}</h3><p>{t.emptyBody}</p></div> : jobs.data.map(job => <JobStatus key={job.id} job={job} />)}
  </section>;
}
