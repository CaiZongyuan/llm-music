import type { JobRead } from '@llm-music/api-client';
import { useMessages } from '../preferences/Preferences';
import { jobMessages } from './messages';
import { isActiveJob } from './queries';
import { JobLink } from './JobLink';

export function problemMessage(code: unknown, t: ReturnType<typeof useMessages<typeof jobMessages>>) {
  if (code === 'runtime_out_of_memory') return t.memoryReason;
  if (code === 'model_missing') return t.modelReason;
  if (code === 'workflow_invalid') return t.workflowReason;
  if (code === 'runtime_unavailable' || code === 'runtime_observation_stale' || code === 'runtime_evidence_stale' || code === 'model_evidence_stale' || code === 'retry_unconfirmed' || code === 'submission_unconfirmed') return t.runtimeReason;
  if (typeof code === 'string' && code.startsWith('cancellation_')) return t.ownershipReason;
  if (code === 'generation_failed' || code === 'transcription_failed') return t.creativeReason;
  if (code === 'cancelled') return t.cancelledReason;
  return t.genericReason;
}

export function JobStatus({ job }: { job: JobRead }) {
  const t = useMessages(jobMessages);
  const active = isActiveJob(job);
  const phase = job.phase && Object.hasOwn(t, job.phase) ? t[job.phase as keyof typeof t] : t[job.status];
  return <article className="job-card" aria-label={`${t[job.operation]} ${job.id}`}><div className="section-heading"><strong>{t[job.operation]}</strong><span className={`tag ${job.status}`}>{t[job.status]}</span></div>
    {active ? <><p>{phase}</p>{job.progress === null || job.progress === undefined ? <div className="loading"><span className="pulse" /><small>{t.unknown}</small></div> : <><progress max={1} value={job.progress} aria-label={t.measured} /><small>{Math.round(job.progress * 100)}%</small></>}</> : null}
    {job.cancel_requested ? <p>{t.cancel}</p> : null}{job.recovery_required ? <p>{t.recovery}</p> : null}
    {job.error ? <div className="job-problem" role={job.status === 'cancelled' ? undefined : 'alert'}><strong>{t.problem}</strong><p>{problemMessage(job.error.code, t)}</p>{typeof job.error.code === 'string' ? <small>{t.code}: <code>{job.error.code}</code></small> : null}</div> : null}
    {job.status === 'completed' ? <p>{t.result}</p> : null}
    {job.status === 'completed' && job.result ? <div className="job-result-links">
      {job.result.score_id ? <JobLink href={`/projects/${encodeURIComponent(job.project_id)}/scores/${encodeURIComponent(job.result.score_id)}`}>{t.inspectScore}</JobLink> : null}
      {job.operation === 'Generate' && job.result.candidate_id ? <JobLink href={`/projects/${encodeURIComponent(job.project_id)}/generate?jobId=${encodeURIComponent(job.id)}`}>{t.inspectMusic}</JobLink> : null}
    </div> : null}
    {typeof job.provenance.retry_of_job_id === 'string' ? <small>{t.retryOf}: <code>{job.provenance.retry_of_job_id}</code></small> : null}
    <small className="record-id">{t.identity}: {job.id}</small>
  </article>;
}
