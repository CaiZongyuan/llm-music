import type { JobRead } from '@llm-music/api-client';
import { useMessages } from '../preferences/Preferences';
import { jobMessages } from './messages';

export function JobStatus({ job }: { job: JobRead }) {
  const t = useMessages(jobMessages);
  const active = job.status === 'queued' || job.status === 'running';
  const phase = job.phase && Object.hasOwn(t, job.phase) ? t[job.phase as keyof typeof t] : t[job.status];
  return <article className="job-card" aria-label={`${t[job.operation]} ${job.id}`}><div className="section-heading"><strong>{t[job.operation]}</strong><span className={`tag ${job.status}`}>{t[job.status]}</span></div>
    {active ? <><p>{phase}</p>{job.progress === null || job.progress === undefined ? <div className="loading"><span className="pulse" /><small>{t.unknown}</small></div> : <><progress max={1} value={job.progress} aria-label={t.measured} /><small>{Math.round(job.progress * 100)}%</small></>}</> : null}
    {job.cancel_requested ? <p>{t.cancel}</p> : null}{job.recovery_required ? <p>{t.recovery}</p> : null}
    {job.error ? <p role="alert">{t.error}{typeof job.error.code === 'string' ? <small>{t.code}: {job.error.code}</small> : null}</p> : null}
    <small className="record-id">{t.identity}: {job.id}</small>
  </article>;
}
