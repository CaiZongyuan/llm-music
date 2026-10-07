import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { GenerateCreate } from '@llm-music/api-client';
import { ErrorNotice, Loading } from '../../components/States';
import { JobState, jobOptions, useSubmitGenerate } from '../jobs';
import { candidatesOptions, candidateKeys } from '../candidates/queries';
import { Candidate } from '../candidates/Candidate';
import { versionsOptions } from '../versions/queries';
import { useMessages } from '../preferences/Preferences';
import { useGenerationDraft } from './drafts';
import { generationMessages } from './messages';
import { CapabilityReadiness, capabilitiesOptions, operationReady } from '../runtime/capabilities';
import './generation.css';

type GenerateSearch = { jobId?: string; candidateId?: string };
function restoredInputs(inputs?: Record<string, unknown>): GenerateCreate | undefined {
  if (typeof inputs?.style !== 'string' || typeof inputs.lyrics !== 'string' || typeof inputs.seed !== 'number') return;
  return { style: inputs.style, lyrics: inputs.lyrics, seed: inputs.seed, max_seconds: 35 };
}

function GenerateForm({ projectId, initial, onSubmit }: { projectId: string; initial?: GenerateCreate; onSubmit: (jobId: string) => void }) {
  const t = useMessages(generationMessages);
  const [draft, update] = useGenerationDraft(projectId, initial);
  const [validation, setValidation] = useState<'seed' | 'empty' | null>(null);
  const submit = useSubmitGenerate(projectId);
  const capability = useQuery(capabilitiesOptions());
  function generate() {
    if (capability.isError || !operationReady(capability.data, 'Generate')) return;
    const seed = Number(draft.seed);
    if (!/^\d+$/.test(draft.seed) || !Number.isSafeInteger(seed) || seed < 0) { setValidation('seed'); return; }
    if (!draft.style.trim() || !draft.lyrics.trim()) { setValidation('empty'); return; }
    setValidation(null);
    submit.mutate({ style: draft.style, lyrics: draft.lyrics, seed, max_seconds: 35 }, { onSuccess: job => onSubmit(job.id) });
  }
  return <section className="surface"><h2>{t.title}</h2><p className="hint">{t.intro}</p><form onSubmit={event => { event.preventDefault(); if (!submit.isPending) generate(); }}>
    <label>{t.style}<textarea aria-label={t.style} rows={3} maxLength={1024} required value={draft.style} onChange={event => update({ style: event.target.value })} /><span className="field-help">{t.styleHelp}</span></label>
    <label>{t.lyrics}<textarea aria-label={t.lyrics} rows={8} maxLength={10000} required value={draft.lyrics} onChange={event => update({ lyrics: event.target.value })} /><span className="field-help">{t.lyricsHelp}</span></label>
    <div className="field-row"><label>{t.seed}<input aria-label={t.seed} inputMode="numeric" required value={draft.seed} onChange={event => update({ seed: event.target.value })} /><span className="field-help">{t.seedHelp}</span></label><label>{t.seconds}<input readOnly value={t.duration} /></label></div>
    {validation ? <p className="error-box" role="alert">{validation === 'seed' ? t.invalidSeed : t.emptyInput}</p> : null}
    {submit.isError ? <ErrorNotice error={submit.error} /> : null}
    <CapabilityReadiness operation="Generate" />
    <button className="primary" disabled={submit.isPending || capability.isError || !operationReady(capability.data, 'Generate')}>{submit.isPending ? t.submitting : t.submit} →</button><p className="field-help">{t.decide}</p>
  </form></section>;
}

export function Generate({ projectId, search }: { projectId: string; search: GenerateSearch }) {
  const t = useMessages(generationMessages);
  const navigate = useNavigate();
  const cache = useQueryClient();
  // JobState owns the Monitor. This observer only reads its authoritative cache.
  const job = useQuery({ ...jobOptions(projectId, search.jobId ?? ''), enabled: Boolean(search.jobId), refetchInterval: false });
  const candidates = useQuery(candidatesOptions(projectId));
  const versions = useQuery(versionsOptions(projectId));
  const completedCandidateId = job.data?.status === 'completed' ? job.data.result?.candidate_id : undefined;
  useEffect(() => { if (completedCandidateId) void cache.invalidateQueries({ queryKey: candidateKeys.list(projectId), exact: true }); }, [cache, projectId, completedCandidateId]);
  const selected = search.candidateId ?? completedCandidateId ?? (search.jobId ? undefined : candidates.data?.at(-1)?.id);
  function submitted(jobId: string) { void navigate({ to: '/projects/$projectId/generate', params: { projectId }, search: { jobId } }); }
  return <div className="workspace-grid generation-grid"><div>{search.jobId && job.isPending ? <Loading /> : search.jobId && job.isError && !job.data ? <ErrorNotice error={job.error} onRetry={() => void job.refetch()} /> : <GenerateForm projectId={projectId} initial={restoredInputs(job.data?.inputs)} onSubmit={submitted} />}</div><div className="generation-results">
    {search.jobId ? <section className="surface"><h2>{t.job}</h2><JobState projectId={projectId} jobId={search.jobId} onRetry={retried => submitted(retried.id)} /></section> : null}
    {selected ? <Candidate projectId={projectId} candidateId={selected} /> : <section className="surface soft"><div className="empty"><h2>{t.empty}</h2><p>{t.emptyBody}</p></div></section>}
    <section className="surface"><div className="section-heading"><h2>{t.candidates}</h2><button type="button" onClick={() => void candidates.refetch()}>{t.reload}</button></div>
      {candidates.isPending ? <Loading /> : candidates.isError ? <ErrorNotice error={candidates.error} onRetry={() => void candidates.refetch()} /> : candidates.data.length ? <ul className="candidate-list">{[...candidates.data].reverse().map(candidate => <li key={candidate.id}><Link to="/projects/$projectId/generate" params={{ projectId }} search={{ candidateId: candidate.id }} activeProps={{ className: 'active' }}><strong>{candidate.inputs.style}</strong><small>{t.seed}: {candidate.inputs.seed} · {versions.data?.some(version => version.candidate_id === candidate.id) ? t.saved : t.unsaved}</small><code>{candidate.id}</code></Link></li>)}</ul> : <p className="field-help">{t.emptyBody}</p>}
    </section></div></div>;
}

