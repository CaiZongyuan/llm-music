import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JobRead } from '@llm-music/api-client';
import { ErrorNotice } from '../../components/States';
import { api, ApiFailure, dataOf } from '../../lib/api';
import { Candidate } from '../candidates/Candidate';
import { candidatesOptions } from '../candidates/queries';
import { useGenerationDraft } from '../generation/drafts';
import { generationMessages } from '../generation/messages';
import { InputsSnapshot } from '../generation/InputsSnapshot';
import { JobState } from '../jobs/JobState';
import { cacheSubmittedJob, isActiveJob, jobOptions, projectJobsOptions } from '../jobs/queries';
import { defineMessages, useMessages } from '../preferences/Preferences';
import { CapabilityReadiness, capabilitiesOptions, operationReady } from '../runtime/capabilities';
import { selectedScore, subscribeSelectedScore } from './drafts';
import { retainScoreSubmission, scoreGenerationInputs, scoreSubmission, useScoreSubmission, type ScoreSubmission } from './submissions';
import '../generation/generation.css';

const messages = defineMessages({ title: '从选定 Score 重新生成', help: '先选定有效且已保存的乐谱，再尝试另一个风格。提交后仍可编辑草稿。', submit: '从选定 Score 生成', none: '请先检查并保存选定当前草稿。',
  unknown: '提交尚未确认', recover: '已保留点击时的输入。先读取项目任务，检查实际提交内容；不会自动再次生成。', readJobs: '读取项目任务', inspectJob: '打开这次任务', emptyJobs: '没有读到生成任务。仍需确认原请求，再决定是否发起新的尝试。', newAttempt: '确认后发起新的明确尝试', duplicate: '新的尝试可能与未确认的原请求同时存在。请先查看原任务。', frozen: '本次任务使用提交时的乐谱与来源。继续修改不会改变它。', sending: '正在等待应用确认本次提交。', previous: '之前完成的候选结果', previousHelp: '这不是当前运行中或失败任务的新结果；原候选仍可试听与保存。' },
  { title: 'Regenerate from selected Score', help: 'Select a valid saved Score, then try another style. You can keep editing after submission.', submit: 'Generate from selected Score', none: 'Check and save/select the current draft first.',
    unknown: 'Submission is unconfirmed', recover: 'The captured inputs remain. Read project jobs and inspect the actual submitted content first; generation is never sent again automatically.', readJobs: 'Read project jobs', inspectJob: 'Open this job', emptyJobs: 'No generation job was read. Confirm the original request before deciding on another attempt.', newAttempt: 'Start another explicit attempt after checking', duplicate: 'Another attempt may coexist with the unconfirmed request. Inspect the original jobs first.', frozen: 'This job uses the Score and origin captured at submission. Further edits do not change it.', sending: 'Waiting for the application to acknowledge this submission.', previous: 'Previously completed Candidate', previousHelp: 'This is not a new result of the running or failed Job. The earlier Candidate remains available to listen and save.' });

function rejectedBeforeJob(error: unknown) {
  return error instanceof ApiFailure && error.status >= 400 && (error.status < 500 || ['model_missing', 'capability_missing', 'runtime_unavailable', 'runtime_observation_stale', 'runtime_evidence_stale', 'model_evidence_stale'].includes(error.detail?.code ?? ''));
}

export function ScoreGeneration({ projectId }: { projectId: string }) {
  const t = useMessages(messages), g = useMessages(generationMessages);
  const score = useSyncExternalStore(subscribeSelectedScore, () => selectedScore(projectId));
  const [validation, setValidation] = useState<'seed' | 'empty' | null>(null);
  const [jobsRead, setJobsRead] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const submission = useScoreSubmission(projectId);
  const uncertain = submission?.state === 'unconfirmed';
  const cache = useQueryClient(), navigate = useNavigate();
  const search = useSearch({ strict: false });
  const jobId = search.jobId ?? submission?.jobId;
  const job = useQuery({ ...jobOptions(projectId, jobId ?? ''), enabled: Boolean(jobId), refetchInterval: false });
  const restored = submission?.body ?? (job.data?.operation === 'GenerateFromScore' ? scoreGenerationInputs(job.data.inputs) ?? undefined : undefined);
  const [draft, update] = useGenerationDraft(projectId, restored);
  const capability = useQuery(capabilitiesOptions());
  const candidates = useQuery(candidatesOptions(projectId));
  const jobs = useQuery({ ...projectJobsOptions(projectId), enabled: false, refetchInterval: false });
  function openJob(id: string) { void navigate({ to: '.', search: { jobId: id } }); }
  const submit = useMutation({ retry: false,
    mutationFn: async ({ body }: ScoreSubmission) => {
      const result = await api.POST('/projects/{project_id}/jobs/generate-from-score', { params: { path: { project_id: projectId } }, body });
      const job = dataOf(result);
      // A successful status alone does not identify the accepted work. Guard
      // application identity before writing Query or acknowledging this intent.
      if (!job || typeof job.id !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(job.id)
          || job.project_id !== projectId || job.operation !== 'GenerateFromScore') throw new ApiFailure(result.response.status);
      return job;
    },
    onSuccess: async (job, intent) => {
      await cacheSubmittedJob(cache, job);
      if (scoreSubmission(projectId)?.id !== intent.id) return;
      retainScoreSubmission(projectId, { ...intent, state: 'acknowledged', jobId: job.id });
      if (mounted.current) openJob(job.id);
    },
    onError: (error, intent) => {
      if (scoreSubmission(projectId)?.id === intent.id) retainScoreSubmission(projectId, rejectedBeforeJob(error) ? null : { ...intent, state: 'unconfirmed' });
    },
    onSettled: () => { pending.current = false; },
  });
  function generate() {
    const selected = selectedScore(projectId);
    const existing = scoreSubmission(projectId);
    if (!selected || pending.current || existing?.state === 'submitting' || existing?.state === 'unconfirmed' || capability.isError || !operationReady(capability.data, 'GenerateFromScore') || (job.data && isActiveJob(job.data)) || (jobId && !job.isSuccess)) return;
    const seed = Number(draft.seed);
    if (!/^\d+$/.test(draft.seed) || !Number.isSafeInteger(seed) || seed < 0) { setValidation('seed'); return; }
    if (!draft.style.trim() || !draft.lyrics.trim()) { setValidation('empty'); return; }
    setValidation(null); setJobsRead(false); pending.current = true;
    const intent: ScoreSubmission = Object.freeze({ id: crypto.randomUUID(), state: 'submitting', body: Object.freeze({ abc: selected.abc, source_score_id: selected.source_score_id, parent_version_id: selected.parent_version_id,
      style: draft.style.trim(), lyrics: draft.lyrics.trim(), seed, max_seconds: 35 }) });
    retainScoreSubmission(projectId, intent);
    submit.mutate(intent);
  }
  async function recoverJob(value: JobRead) {
    const body = value.operation === 'GenerateFromScore' ? scoreGenerationInputs(value.inputs) : null;
    if (!body || value.project_id !== projectId) return;
    retainScoreSubmission(projectId, { id: crypto.randomUUID(), body, state: 'acknowledged', jobId: value.id });
    await cacheSubmittedJob(cache, value); openJob(value.id);
  }
  const submittedInputs = job.data?.operation === 'GenerateFromScore' ? scoreGenerationInputs(job.data.inputs) : null;
  const completedId = job.data?.status === 'completed' ? job.data.result?.candidate_id : undefined;
  const candidateId = completedId ?? candidates.data?.filter(value => 'source_score_id' in value.inputs).at(-1)?.id;
  return <section className="score-regeneration" aria-label={t.title} data-generation-score-id={score?.source_score_id}>
    <div className="workspace-grid generation-grid"><div><section className="surface"><h2>{t.title}</h2><p className="hint">{t.help}</p><form onSubmit={event => { event.preventDefault(); generate(); }}>
      <label>{g.style}<textarea aria-label={g.style} rows={3} maxLength={1024} required value={draft.style} onChange={event => update({ style: event.target.value })} /><span className="field-help">{g.styleHelp}</span></label>
      <label>{g.lyrics}<textarea aria-label={g.lyrics} rows={5} maxLength={10000} required value={draft.lyrics} onChange={event => update({ lyrics: event.target.value })} /><span className="field-help">{g.lyricsHelp}</span></label>
      <div className="field-row"><label>{g.seed}<input aria-label={g.seed} inputMode="numeric" required value={draft.seed} onChange={event => update({ seed: event.target.value })} /><span className="field-help">{g.seedHelp}</span></label><label>{g.seconds}<input readOnly value={g.duration} /></label></div>
      {validation ? <p className="error-box" role="alert">{validation === 'seed' ? g.invalidSeed : g.emptyInput}</p> : null}
      {submit.isError && !uncertain ? <ErrorNotice error={submit.error} /> : null}
      <CapabilityReadiness operation="GenerateFromScore" />
      {!score ? <p className="hint">{t.none}</p> : null}
      <button className="primary" disabled={!score || submission?.state === 'submitting' || uncertain || submit.isPending || capability.isError || !operationReady(capability.data, 'GenerateFromScore') || Boolean(job.data && isActiveJob(job.data)) || Boolean(jobId && !job.isSuccess)}>{submission?.state === 'submitting' ? g.submitting : t.submit}</button><p className="field-help">{g.decide}</p>
    </form></section>
    {submission?.state === 'submitting' ? <p role="status">{t.sending}</p> : null}
    {uncertain && submission ? <section className="surface submission-recovery" role="alert"><h3>{t.unknown}</h3><p>{t.recover}</p><InputsSnapshot projectId={projectId} inputs={submission.body} provenance={{}} />
      <button type="button" disabled={jobs.isFetching} onClick={() => { void jobs.refetch().then(result => setJobsRead(result.isSuccess)); }}>{t.readJobs}</button>
      {jobs.isError ? <ErrorNotice error={jobs.error} onRetry={() => void jobs.refetch()} /> : null}
      {jobsRead && jobs.isSuccess ? <><ul>{jobs.data.filter(value => value.operation === 'GenerateFromScore').map(value => <li key={value.id}><button type="button" onClick={() => void recoverJob(value)}>{t.inspectJob}: {String(value.inputs.style)} · {String(value.inputs.seed)} · {value.id}</button></li>)}</ul>
        {!jobs.data.some(value => value.operation === 'GenerateFromScore') ? <p>{t.emptyJobs}</p> : null}<p className="hint">{t.duplicate}</p><button type="button" onClick={() => { retainScoreSubmission(projectId, null); submit.reset(); }}>{t.newAttempt}</button></> : null}
    </section> : null}
    </div><div className="generation-results">{jobId ? <section className="surface job-submitted-inputs"><h2>{g.job}</h2><p className="hint">{t.frozen}</p>{submittedInputs ? <InputsSnapshot projectId={projectId} inputs={submittedInputs} provenance={job.data?.provenance ?? {}} /> : null}<JobState projectId={projectId} jobId={jobId} onRetry={retried => { void recoverJob(retried); }} /></section> : null}
    {candidates.isError ? <ErrorNotice error={candidates.error} onRetry={() => void candidates.refetch()} /> : null}
    {candidateId ? <>{!completedId ? <><h3>{t.previous}</h3><p className="hint">{t.previousHelp}</p></> : null}<Candidate projectId={projectId} candidateId={candidateId} /></> : candidates.isError ? null : <section className="surface soft"><h2>{g.empty}</h2><p className="hint">{g.emptyBody}</p></section>}
  </div></div></section>;
}
