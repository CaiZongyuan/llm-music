import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { JobRead } from '@llm-music/api-client';
import { Loading, ErrorNotice } from '../../components/States';
import { ApiFailure } from '../../lib/api';
import { useMessages } from '../preferences/Preferences';
import { jobMessages } from './messages';
import { isActiveJob, projectJobsOptions } from './queries';
import { useJobMonitor } from './monitor';
import { useCancelJob, useRetryJob } from './mutations';
import { JobStatus, problemMessage } from './JobStatus';
import './jobs.css';

function JobControls({ job, onRetry }: { job: JobRead; onRetry?: (job: JobRead) => void }) {
  const t = useMessages(jobMessages);
  const cancel = useCancelJob(job.project_id, job.id);
  const retry = useRetryJob(job.project_id, job.id);
  const retryable = job.status === 'failed' || job.status === 'cancelled';
  const attempts = useQuery({ ...projectJobsOptions(job.project_id), enabled: retryable });
  const newAttempt = retry.data ?? attempts.data?.find(item => item.provenance.retry_of_job_id === job.id);
  const uncertain = retry.isError && (!(retry.error instanceof ApiFailure) || retry.error.status >= 500 || retry.error.detail?.code.includes('unconfirmed'));
  async function createRetry() {
    try { const next = await retry.mutateAsync(); onRetry?.(next); } catch { /* Keep the readable outcome below; never automatically resend. */ }
  }
  return <div className="job-controls">
    {isActiveJob(job) ? <button type="button" disabled={cancel.isPending} onClick={() => cancel.mutate()}>{cancel.isPending ? t.cancelPending : job.cancel_requested ? t.cancelAgain : t.cancelAction}</button> : null}
    {cancel.isPending ? <p role="status">{t.cancel}</p> : null}
    {cancel.isError ? <div className="error-box" role="alert"><p>{problemMessage(cancel.error instanceof ApiFailure ? cancel.error.detail?.code : 'runtime_unavailable', t)}</p></div> : null}
    {retryable && !newAttempt ? <><p className="hint">{t.retryHelp}</p><button type="button" disabled={retry.isPending || Boolean(uncertain) || attempts.isPending || attempts.isError} onClick={() => void createRetry()}>{retry.isPending ? t.retryPending : t.retryAction}</button></> : null}
    {retry.isError ? <div className="error-box" role="alert"><p>{uncertain ? t.retryUnconfirmed : problemMessage(retry.error instanceof ApiFailure ? retry.error.detail?.code : undefined, t)}</p><button type="button" onClick={() => void attempts.refetch()}>{t.inspectAttempt}</button></div> : null}
    {attempts.isError ? <ErrorNotice error={attempts.error} onRetry={() => void attempts.refetch()} /> : null}
    {newAttempt ? <p className="job-attempt">{t.newAttempt}: <Link className="inline-link" to="/projects/$projectId/jobs" params={{ projectId: job.project_id }} search={{ jobId: newAttempt.id }} onClick={() => onRetry?.(newAttempt)}><code>{newAttempt.id}</code></Link></p> : null}
  </div>;
}

function MonitoredJob({ projectId, jobId, initialData, onRetry, refresh = false }: { projectId: string; jobId: string; initialData?: JobRead; onRetry?: (job: JobRead) => void; refresh?: boolean }) {
  const t = useMessages(jobMessages);
  const job = useJobMonitor(projectId, jobId, initialData);
  if (job.isPending) return <Loading />;
  if (!job.data) return <ErrorNotice error={job.error} onRetry={() => void job.refetch()} />;
  return <div className="job-monitor" data-job-id={jobId}>
    {job.isError ? <ErrorNotice error={job.error} onRetry={() => void job.refetch()} /> : null}
    <JobStatus job={job.data} />
    {job.connection !== 'settled' ? <p className="job-connection" role="status">{t[job.connection]}</p> : null}
    <JobControls key={job.data.id} job={job.data} onRetry={onRetry} />
    {refresh ? <button type="button" disabled={job.isFetching} onClick={() => void job.refetch()}>{t.refresh}</button> : null}
  </div>;
}

export function JobState({ projectId, jobId, onRetry }: { projectId: string; jobId: string; onRetry?: (job: JobRead) => void }) {
  return <MonitoredJob projectId={projectId} jobId={jobId} onRetry={onRetry} refresh />;
}
export function ProjectJobs({ projectId }: { projectId: string }) {
  const t = useMessages(jobMessages);
  const jobs = useQuery(projectJobsOptions(projectId));
  return <section className="surface jobs-summary"><div className="section-heading"><h2>{t.title}</h2><button type="button" disabled={jobs.isFetching} onClick={() => void jobs.refetch()}>{t.refresh}</button></div>
    {jobs.isPending ? <Loading /> : null}
    {jobs.isError ? <ErrorNotice error={jobs.error} onRetry={() => void jobs.refetch()} /> : null}
    {jobs.data?.length === 0 ? <div className="empty"><h3>{t.empty}</h3><p>{t.emptyBody}</p></div> : jobs.data?.map(job => <MonitoredJob key={job.id} projectId={projectId} jobId={job.id} initialData={job} />)}
  </section>;
}
