import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@llm-music/api-client';
import { api, ApiFailure, dataOf, type AssetRead } from '../../lib/api';
import { ErrorNotice, Loading } from '../../components/States';
import { ReferenceAssets } from '../assets/ReferenceAssets';
import { assetKeys, assetsOptions } from '../assets/queries';
import { JobState } from '../jobs/JobState';
import { cacheSubmittedJob, isActiveJob, jobOptions, projectJobsOptions } from '../jobs/queries';
import { selectPlayerAsset } from '../player';
import { useMessages } from '../preferences/Preferences';
import { CapabilityReadiness, capabilitiesOptions, operationReady } from '../runtime/capabilities';
import { ScoreEditor } from '../scores/ScoreEditor';
import { abcOptions, scoreOptions } from '../scores/queries';
import { versionsOptions } from '../versions/queries';
import { acknowledgedJob, CoverGeneration, rejectedBeforeJob } from './CoverGeneration';
import { coverMessages } from './messages';
import { ReferenceOrigin } from './ReferenceOrigin';
import { referenceIntent, retainReferenceIntent, useReferenceIntent, type ReferenceIntent } from './submissions';
import './cover.css';

export type CoverRouteSelection = { referenceAssetId?: string; transcriptionJobId?: string; scoreId?: string; jobId?: string };
function InspectedScore({ projectId, scoreId, referenceId, blocked, jobId, onJob }: {
  projectId: string; scoreId: string; referenceId?: string; blocked: boolean; jobId?: string; onJob: (jobId: string) => void;
}) {
  const score = useQuery(scoreOptions(projectId, scoreId));
  const abc = useQuery({ ...abcOptions(projectId, score.data?.abc_asset_id ?? ''), enabled: Boolean(score.data) });
  const t = useMessages(coverMessages);
  if (score.isPending) return <Loading />;
  if (score.isError) return <ErrorNotice error={score.error} onRetry={() => void score.refetch()} />;
  if (abc.isPending) return <Loading />;
  if (abc.isError) return <ErrorNotice error={abc.error} onRetry={() => void abc.refetch()} />;
  const mismatched = score.data.source_reference_asset_id !== referenceId;
  return <><p className="identity-label">{t.sourceScore}<code>{score.data.id}</code></p>{mismatched ? <p className="hint">{t.sourceChanged}</p> : null}
    <ScoreEditor key={score.data.id} projectId={projectId} score={score.data} initialABC={abc.data} generation={<CoverGeneration projectId={projectId} referenceId={referenceId} sourceScoreId={scoreId} blocked={blocked || mismatched} jobId={jobId} onJob={onJob} />} /></>;
}
export function Cover({ projectId, selection, onSelect }: { projectId: string; selection: CoverRouteSelection; onSelect: (value: CoverRouteSelection) => void }) {
  const t = useMessages(coverMessages), cache = useQueryClient();
  const assets = useQuery(assetsOptions(projectId)), versions = useQuery(versionsOptions(projectId)), jobs = useQuery(projectJobsOptions(projectId));
  const readiness = useQuery(capabilitiesOptions());
  const references = assets.data?.filter(asset => asset.kind === 'reference_audio') ?? [];
  const referenceId = selection.referenceAssetId ?? references[0]?.id, reference = references.find(asset => asset.id === referenceId);
  const [sourceVersion, setSourceVersion] = useState(''), versionId = sourceVersion || versions.data?.[0]?.id;
  const sourceVersionRef = useRef(versionId); sourceVersionRef.current = versionId;
  const referenceIdRef = useRef(referenceId); referenceIdRef.current = referenceId;
  const currentSelection = useRef(selection); currentSelection.current = selection;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function patch(value: Partial<CoverRouteSelection>) { if (mounted.current) onSelect({ ...currentSelection.current, ...value }); }
  const transcriptions = jobs.data?.filter(job => job.operation === 'Transcribe' && job.inputs.reference_asset_id === referenceId) ?? [];
  const transcriptionId = selection.transcriptionJobId && transcriptions.some(job => job.id === selection.transcriptionJobId) ? selection.transcriptionJobId : transcriptions.at(-1)?.id;
  const transcription = useQuery({ ...jobOptions(projectId, transcriptionId ?? ''), enabled: Boolean(transcriptionId) });
  const scoreId = transcription.data?.status === 'completed' ? transcription.data.result?.score_id ?? selection.scoreId : selection.scoreId;
  const profile = reference?.sample_width_bits === 16 && reference.duration_seconds === 16 && (reference.channels === 1 && reference.sample_rate === 24_000 || reference.channels === 2 && reference.sample_rate === 48_000);
  const capturedReference = useReferenceIntent(projectId), referencePending = useRef(false);
  const derive = useMutation({ retry: false, mutationFn: async ({ intent, recover }: { intent: ReferenceIntent; recover: boolean }) => {
    if (recover) {
      const existing = await api.GET('/projects/{project_id}/assets/{asset_id}', { params: { path: { project_id: projectId, asset_id: intent.save_id } } });
      if (existing.response.ok) {
        const origin = dataOf(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { project_id: projectId, asset_id: intent.save_id } } }));
        if (!origin || origin.reference_asset_id !== intent.save_id || origin.source_version_id !== intent.source_version_id) throw new ApiFailure(409);
        return dataOf(existing);
      }
      if (existing.response.status !== 404) throw new ApiFailure(existing.response.status, existing.error?.error);
    }
    const result = await api.POST('/projects/{project_id}/reference-audio/from-version', { params: { path: { project_id: projectId } }, body: intent });
    const asset = dataOf(result); if (!asset || asset.id !== intent.save_id || asset.kind !== 'reference_audio') throw new ApiFailure(result.response.status);
    return asset;
  }, onSuccess: async (asset, { intent, recover }) => {
    await cache.cancelQueries({ queryKey: assetKeys.list(projectId), exact: true });
    cache.setQueryData<AssetRead[]>(assetKeys.list(projectId), previous => [...(previous ?? []).filter(item => item.id !== asset.id), asset]);
    cache.setQueryData(assetKeys.detail(projectId, asset.id), asset); void cache.invalidateQueries({ queryKey: assetKeys.list(projectId), exact: true });
    if (referenceIntent(projectId)?.save_id !== intent.save_id) return;
    retainReferenceIntent(projectId, null);
    if (recover || sourceVersionRef.current === intent.source_version_id) patch({ referenceAssetId: asset.id, transcriptionJobId: undefined, scoreId });
  }, onError: (error, { intent }) => { if (referenceIntent(projectId)?.save_id === intent.save_id && rejectedBeforeJob(error)) retainReferenceIntent(projectId, null); }, onSettled: () => { referencePending.current = false; } });
  function deriveReference(recover = false) {
    if (referencePending.current || derive.isPending) return;
    let intent = referenceIntent(projectId);
    if (!intent) { if (!versionId) return; intent = Object.freeze({ source_version_id: versionId, save_id: crypto.randomUUID() }); }
    if (!recover && referenceIntent(projectId)) return;
    referencePending.current = true; retainReferenceIntent(projectId, intent); derive.mutate({ intent, recover });
  }
  const transcribe = useMutation({ retry: false, mutationFn: async (body: components['schemas']['TranscribeCreate']) => {
    const result = await api.POST('/projects/{project_id}/transcriptions', { params: { path: { project_id: projectId } }, body });
    return acknowledgedJob(dataOf(result), projectId, 'Transcribe', result.response.status);
  }, onSuccess: async (job, body) => {
    await cacheSubmittedJob(cache, job);
    if (referenceIdRef.current === body.reference_asset_id) patch({ transcriptionJobId: job.id, scoreId });
  } });
  const transcriptActive = Boolean(transcription.data && isActiveJob(transcription.data));
  const transcriptUncertain = transcribe.isError && !rejectedBeforeJob(transcribe.error);
  function onJob(jobId: string) { patch({ jobId: jobId || undefined }); }
  return <section className="cover-workspace" aria-label="Cover"><div className="score-editor-heading"><h2>{t.title}</h2><p className="hint">{t.intro}</p></div>
    <details className="surface cover-upload"><summary>{t.uploadReference}</summary><ReferenceAssets projectId={projectId} /></details>
    <section className="cover-reference surface" aria-label={t.referenceTitle}><h2>{t.referenceTitle}</h2><div className="workspace-grid"><div>
      <label>{t.version}<select value={versionId ?? ''} disabled={derive.isPending || versions.isPending || Boolean(capturedReference)} onChange={event => setSourceVersion(event.target.value)}>{!versions.data?.length ? <option value="">{t.emptyVersion}</option> : null}{versions.data?.map(version => <option key={version.id} value={version.id}>{version.name}</option>)}</select></label>
      <p className="hint">{t.deriveHelp}</p>{versions.isError ? <ErrorNotice error={versions.error} onRetry={() => void versions.refetch()} /> : null}
      <button type="button" disabled={!versionId || derive.isPending || Boolean(capturedReference)} onClick={() => deriveReference()}>{derive.isPending ? t.deriving : t.derive}</button>
      {capturedReference && !derive.isPending ? <section className="error-box reference-recovery" role="alert"><h3>{t.referenceUnknown}</h3><p>{t.referenceRecover}</p><code>{capturedReference.source_version_id}</code><code>{capturedReference.save_id}</code><button type="button" onClick={() => deriveReference(true)}>{t.recoverReference}</button></section> : null}{derive.isError ? <ErrorNotice error={derive.error} /> : null}
    </div><div><label>{t.reference}<select value={referenceId ?? ''} disabled={assets.isPending || !references.length} onChange={event => { patch({ referenceAssetId: event.target.value, transcriptionJobId: undefined, scoreId }); transcribe.reset(); }}>{!references.length ? <option value="">{t.emptyReference}</option> : null}{references.map(asset => <option key={asset.id} value={asset.id}>{asset.original_name}</option>)}</select></label>
      {assets.isPending ? <Loading /> : assets.isError ? <ErrorNotice error={assets.error} onRetry={() => void assets.refetch()} /> : null}
      {reference ? <><ReferenceOrigin projectId={projectId} assetId={reference.id} /><button type="button" onClick={() => selectPlayerAsset({ projectId, assetId: reference.id, label: reference.original_name })}>{t.listenReference}</button><small className="identity-label"><code>{reference.id}</code></small></> : null}
      <p className="hint">{t.profile}</p>{reference && !profile ? <p className="error-box" role="alert">{t.unsupported}</p> : null}<CapabilityReadiness operation="Transcribe" />
      <button className="primary" type="button" disabled={!profile || transcribe.isPending || transcriptActive || transcriptUncertain || readiness.isError || !operationReady(readiness.data, 'Transcribe')} onClick={() => { if (referenceId) transcribe.mutate({ reference_asset_id: referenceId }); }}>{transcribe.isPending ? t.transcribing : t.transcribe}</button>
      {transcribe.isError ? <><ErrorNotice error={transcribe.error} /><p>{t.transcriptionUnknown}</p></> : null}
    </div></div><div className="cover-mode"><h3>{t.mode}</h3><label><input type="radio" name="cover-mode" value="melody" checked readOnly />{t.melody}</label><label><input type="radio" name="cover-mode" value="full" disabled />{t.full}</label><p className="hint">{t.modeHelp}</p></div>
    </section><section className="surface cover-transcription" aria-label={t.transcription}><div className="section-heading"><h3>{t.transcription}</h3><button type="button" onClick={() => void jobs.refetch()}>{t.readJobs}</button></div>
      {jobs.isError ? <ErrorNotice error={jobs.error} onRetry={() => void jobs.refetch()} /> : null}<div className="cover-attempts">{transcriptions.map(job => <button type="button" key={job.id} aria-pressed={job.id === transcriptionId} onClick={() => { patch({ transcriptionJobId: job.id, scoreId }); transcribe.reset(); }}>{t.chooseTranscription}: <code>{job.id}</code></button>)}</div>
      {transcriptionId ? <JobState key={transcriptionId} projectId={projectId} jobId={transcriptionId} onRetry={job => patch({ transcriptionJobId: job.id, scoreId })} /> : <p className="hint">{t.noScoreHelp}</p>}
    </section><section className="cover-inspection" aria-label={t.inspection} data-source-score-id={scoreId} data-reference-id={referenceId}><h2>{t.inspection}</h2>
      {scoreId ? <InspectedScore key={scoreId} projectId={projectId} scoreId={scoreId} referenceId={referenceId} blocked={transcriptActive} jobId={selection.jobId} onJob={onJob} /> : <><section className="surface empty"><h3>{t.noScore}</h3><p>{t.noScoreHelp}</p></section><CoverGeneration projectId={projectId} referenceId={referenceId} blocked jobId={selection.jobId} onJob={onJob} /></>}
    </section>
  </section>;
}
