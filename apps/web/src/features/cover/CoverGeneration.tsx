import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CoverCreate, JobRead } from '@llm-music/api-client';
import { api, ApiFailure, dataOf } from '../../lib/api';
import { ErrorNotice } from '../../components/States';
import { Candidate } from '../candidates/Candidate';
import { candidatesOptions } from '../candidates/queries';
import { useGenerationDraft } from '../generation/drafts';
import { InputsSnapshot } from '../generation/InputsSnapshot';
import { generationMessages } from '../generation/messages';
import { JobState } from '../jobs/JobState';
import { cacheSubmittedJob, isActiveJob, jobOptions, projectJobsOptions } from '../jobs/queries';
import { useMessages } from '../preferences/Preferences';
import { CapabilityReadiness, capabilitiesOptions, operationReady } from '../runtime/capabilities';
import { selectedScore, subscribeSelectedScore } from '../scores/drafts';
import { scoreOptions } from '../scores/queries';
import { coverMessages, coverModeText } from './messages';
import { EffectiveScore } from './EffectiveScore';
import { chooseCoverInput, coverSelection, inspectCoverInput, useCoverSelection, type CoverInspection } from './selection';
import { coverInputs, coverSubmission, retainCoverSubmission, useCoverSubmission, type CoverSubmission } from './submissions';

export function rejectedBeforeJob(error: unknown) {
  return error instanceof ApiFailure && error.status >= 400 && (error.status < 500 || ['model_missing', 'capability_missing', 'cover_mode_unavailable', 'runtime_unavailable', 'runtime_observation_stale', 'runtime_evidence_stale', 'model_evidence_stale'].includes(error.detail?.code ?? ''));
}
export function acknowledgedJob(value: JobRead, projectId: string, operation: 'Cover' | 'Transcribe', status: number) {
  if (!value || typeof value.id !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value.id) || value.project_id !== projectId || value.operation !== operation) throw new ApiFailure(status);
  return value;
}
export function CoverGeneration({ projectId, referenceId, sourceScoreId, blocked, jobId: routeJobId, onJob }: {
  projectId: string; referenceId?: string; sourceScoreId?: string; blocked: boolean; jobId?: string; onJob: (jobId: string) => void;
}) {
  const t = useMessages(coverMessages), g = useMessages(generationMessages), cache = useQueryClient();
  const score = useSyncExternalStore(subscribeSelectedScore, () => selectedScore(projectId));
  const saved = useQuery({ ...scoreOptions(projectId, score?.source_score_id ?? ''), enabled: Boolean(score) });
  const scopeMatches = Boolean(score && sourceScoreId && referenceId && saved.data && saved.data.source_reference_asset_id === referenceId
    && (saved.data.id === sourceScoreId || saved.data.source_score_id === sourceScoreId) && saved.data.parent_version_id === score.parent_version_id && !blocked);
  const latest = useRef({ score, referenceId, sourceScoreId }); latest.current = { score, referenceId, sourceScoreId };
  const { mode, modeRevision, inspection, choice } = useCoverSelection(projectId);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const inspectionCurrent = scopeMatches && inspection?.score === score && inspection.referenceId === referenceId && inspection.contextScoreId === sourceScoreId
    && inspection.mode === mode && inspection.modeRevision === modeRevision && inspection.validation.mode === mode;
  const choiceCurrent = inspectionCurrent && choice === inspection;
  const inspect = useMutation({ retry: false, mutationFn: async (captured: Pick<CoverInspection, 'score' | 'referenceId' | 'contextScoreId' | 'mode' | 'modeRevision'>) => {
    const validation = dataOf(await api.POST('/projects/{project_id}/cover-inputs/validate', { params: { path: { project_id: projectId } }, body: { abc: captured.score.abc, mode: captured.mode } }));
    if (validation.mode !== captured.mode || validation.mode_transform_version !== '1.0.0' || validation.abc_sha256 !== captured.score.abcSha256) throw new ApiFailure(409);
    return { ...captured, validation };
  }, onSuccess: value => {
    if (!mounted.current || selectedScore(projectId) !== value.score || latest.current.score !== value.score || latest.current.referenceId !== value.referenceId || latest.current.sourceScoreId !== value.contextScoreId) return;
    inspectCoverInput(projectId, Object.freeze({ ...value, id: crypto.randomUUID() }));
  } });
  const inspectionInMode = inspect.variables?.mode === mode && inspect.variables?.modeRevision === modeRevision;
  const inspectingCurrentMode = inspect.isPending && inspectionInMode;
  const submission = useCoverSubmission(projectId), uncertain = submission?.state === 'unconfirmed';
  const jobId = routeJobId ?? submission?.jobId;
  const job = useQuery({ ...jobOptions(projectId, jobId ?? ''), enabled: Boolean(jobId) });
  const restored = submission?.body ?? (job.data?.operation === 'Cover' ? coverInputs(job.data.inputs) ?? undefined : undefined);
  const [draft, update] = useGenerationDraft(projectId, restored);
  const capabilities = useQuery(capabilitiesOptions()), candidates = useQuery(candidatesOptions(projectId));
  const jobs = useQuery({ ...projectJobsOptions(projectId), enabled: false, refetchInterval: false });
  const [jobsRead, setJobsRead] = useState(false), [validation, setValidation] = useState<'seed' | 'empty' | null>(null);
  const pending = useRef(false);
  const submit = useMutation({ retry: false, mutationFn: async (intent: CoverSubmission) => {
    const result = await api.POST('/projects/{project_id}/jobs/cover', { params: { path: { project_id: projectId } }, body: intent.body });
    return acknowledgedJob(dataOf(result), projectId, 'Cover', result.response.status);
  }, onSuccess: async (value, intent) => {
    await cacheSubmittedJob(cache, value); if (coverSubmission(projectId)?.id !== intent.id) return;
    retainCoverSubmission(projectId, { ...intent, state: 'acknowledged', jobId: value.id }); if (mounted.current) onJob(value.id);
  }, onError: (error, intent) => {
    if (coverSubmission(projectId)?.id === intent.id) retainCoverSubmission(projectId, rejectedBeforeJob(error) ? null : { ...intent, state: 'unconfirmed' });
  }, onSettled: () => { pending.current = false; } });
  const canGenerate = choiceCurrent && !pending.current && !submit.isPending && !uncertain && submission?.state !== 'submitting'
    && !capabilities.isError && operationReady(capabilities.data, 'Cover', mode) && !(job.data && isActiveJob(job.data)) && !(jobId && !job.isSuccess);
  function generate() {
    const current = coverSelection(projectId);
    if (!canGenerate || !choice || current.choice !== choice || choice.mode !== current.mode || choice.modeRevision !== current.modeRevision) return;
    const seed = Number(draft.seed);
    if (!/^\d+$/.test(draft.seed) || !Number.isSafeInteger(seed) || seed < 0) { setValidation('seed'); return; }
    if (!draft.style.trim() || !draft.lyrics.trim()) { setValidation('empty'); return; }
    setValidation(null); setJobsRead(false); pending.current = true;
    const body: CoverCreate = { abc: choice.score.abc, source_score_id: choice.score.source_score_id, parent_version_id: choice.score.parent_version_id,
      reference_asset_id: choice.referenceId, mode: choice.validation.mode, effective_abc_sha256: choice.validation.effective_abc_sha256, mode_transform_version: '1.0.0',
      style: draft.style.trim(), lyrics: draft.lyrics.trim(), seed, max_seconds: 35 };
    const intent: CoverSubmission = Object.freeze({ id: crypto.randomUUID(), body: Object.freeze(body), effectiveABC: choice.validation.effective_abc, state: 'submitting' });
    retainCoverSubmission(projectId, intent); submit.mutate(intent);
  }
  async function recover(value: JobRead) {
    const body = value.operation === 'Cover' ? coverInputs(value.inputs) : null; if (!body || value.project_id !== projectId) return;
    const selected = value.provenance.selected_score;
    const effectiveABC = selected && typeof selected === 'object' && 'effective_abc' in selected && typeof selected.effective_abc === 'string' ? selected.effective_abc : submission?.effectiveABC ?? '';
    retainCoverSubmission(projectId, { id: crypto.randomUUID(), body, effectiveABC, state: 'acknowledged', jobId: value.id }); await cacheSubmittedJob(cache, value); if (mounted.current) onJob(value.id);
  }
  const completeId = job.data?.operation === 'Cover' && job.data.status === 'completed' ? job.data.result?.candidate_id : undefined;
  const previousCandidate = candidates.data?.filter(value => 'mode' in value.inputs && (value.inputs.mode === 'melody' || value.inputs.mode === 'full')).at(-1);
  const previousMode = previousCandidate && 'mode' in previousCandidate.inputs ? previousCandidate.inputs.mode : undefined;
  const candidateId = completeId ?? previousCandidate?.id;
  return <section className="cover-generation" aria-label={t.generateTitle} data-mode={mode} data-mode-revision={modeRevision}>
    <section className="surface cover-effective" aria-label={coverModeText(t.effective, mode)}><h3>{coverModeText(t.effective, mode)}</h3><p className="hint">{mode === 'full' ? t.fullEffectiveHelp : t.effectiveHelp}</p>
      <button type="button" disabled={!scopeMatches || inspectingCurrentMode} onClick={() => { if (score && referenceId && sourceScoreId) inspect.mutate({ score, referenceId, contextScoreId: sourceScoreId, mode, modeRevision }); }}>{coverModeText(inspectingCurrentMode ? t.checkingEffective : t.checkEffective, mode)}</button>
      {!score ? <p>{coverModeText(t.noSelection, mode)}</p> : !scopeMatches ? <p className="hint">{t.sourceChanged}</p> : null}{inspect.isError && inspectionInMode ? <ErrorNotice error={inspect.error} /> : null}
      {inspection ? <><p role="status">{inspectionCurrent ? coverModeText(choiceCurrent ? t.selectedEffective : t.selectEffective, inspection.validation.mode) : t.effectiveStale}</p><h4>{t.effectiveABC} · {inspection.validation.mode}</h4><pre className="score-code" data-effective-abc>{inspection.validation.effective_abc}</pre><details><summary>{t.originalABC}</summary><pre className="score-code" data-original-abc>{inspection.score.abc}</pre></details>
        {inspection.validation.warnings?.includes('full_without_written_chords') ? <p className="hint" role="status">{t.chordlessFull}</p> : null}
        <EffectiveScore key={inspection.id} projectId={projectId} abc={inspection.validation.effective_abc} hash={inspection.validation.effective_abc_sha256} mode={inspection.validation.mode} revision={inspection.score.revision} current={inspectionCurrent} selected={choiceCurrent} onSelect={() => { if (inspectionCurrent) chooseCoverInput(projectId, inspection); }} />
      </> : null}
      <div className="cover-selection" aria-label={t.selected} data-selected-score-id={choice?.score.source_score_id} data-reference-id={choice?.referenceId} data-mode={choice?.validation.mode}><h4>{t.selected}</h4><p>{choiceCurrent && choice ? coverModeText(t.selectedEffective, choice.validation.mode) : choice ? t.effectiveStale : coverModeText(t.noSelection, mode)}</p>{choice ? <><small>{choice.score.source_score_id} · {choice.referenceId} · {choice.validation.mode} · {t.frozen}</small><details><summary>{t.originalABC}</summary><pre className="score-code" data-selected-original-abc>{choice.score.abc}</pre></details><details><summary>{t.effectiveABC}</summary><pre className="score-code" data-selected-effective-abc>{choice.validation.effective_abc}</pre></details></> : null}</div>
    </section><div className="workspace-grid generation-grid"><section className="surface"><h2>{t.generateTitle}</h2><p className="hint">{t.generationHelp}</p><form onSubmit={event => { event.preventDefault(); generate(); }}>
      <label>{g.style}<textarea aria-label={g.style} rows={3} maxLength={1024} required value={draft.style} onChange={event => update({ style: event.target.value })} /></label><label>{g.lyrics}<textarea aria-label={g.lyrics} rows={5} maxLength={10000} required value={draft.lyrics} onChange={event => update({ lyrics: event.target.value })} /></label>
      <div className="field-row"><label>{g.seed}<input aria-label={g.seed} inputMode="numeric" required value={draft.seed} onChange={event => update({ seed: event.target.value })} /></label><label>{g.seconds}<input readOnly value={g.duration} /></label></div>
      {validation ? <p className="error-box" role="alert">{validation === 'seed' ? g.invalidSeed : g.emptyInput}</p> : null}{submit.isError && !uncertain ? <ErrorNotice error={submit.error} /> : null}
      <CapabilityReadiness operation="Cover" mode={mode} /><button type="submit" className="primary" disabled={!canGenerate}>{submission?.state === 'submitting' ? g.submitting : coverModeText(t.generate, mode)}</button>
    </form>{submission?.state === 'submitting' ? <p role="status">{t.sending}</p> : null}</section><div><h2>{t.result}</h2>
      {uncertain && submission ? <section className="surface submission-recovery" role="alert"><h3>{t.unknown}</h3><p>{t.recover}</p><InputsSnapshot projectId={projectId} inputs={submission.body} provenance={{ selected_score: { effective_abc: submission.effectiveABC } }} />
        <button type="button" disabled={jobs.isFetching} onClick={() => { void jobs.refetch().then(result => setJobsRead(result.isSuccess)); }}>{t.readJobs}</button>{jobs.isError ? <ErrorNotice error={jobs.error} onRetry={() => void jobs.refetch()} /> : null}
        {jobsRead && jobs.isSuccess ? <><ul>{jobs.data.filter(value => value.operation === 'Cover').map(value => <li key={value.id}><button type="button" onClick={() => void recover(value)}>{t.inspectJob}: {String(value.inputs.style)} · {String(value.inputs.seed)} · {value.id}</button></li>)}</ul>{!jobs.data.some(value => value.operation === 'Cover') ? <p>{t.emptyJobs}</p> : null}<p className="hint">{t.duplicate}</p><button type="button" onClick={() => { retainCoverSubmission(projectId, null); setJobsRead(false); submit.reset(); onJob(''); }}>{t.newAttempt}</button></> : null}
      </section> : null}{jobId ? <JobState key={jobId} projectId={projectId} jobId={jobId} onRetry={next => void recover(next)} /> : null}
      {candidateId ? <>{!completeId ? <section className="surface soft"><h3>{t.previous} · {previousMode}</h3><p>{t.previousHelp}</p></section> : null}<Candidate key={candidateId} projectId={projectId} candidateId={candidateId} /></> : <section className="surface soft"><h3>{g.empty}</h3><p>{g.emptyBody}</p></section>}
    </div></div>
  </section>;
}
