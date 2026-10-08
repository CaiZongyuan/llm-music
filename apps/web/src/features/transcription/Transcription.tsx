import { type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ErrorNotice, Loading } from '../../components/States';
import { ApiFailure } from '../../lib/api';
import { ReferenceAssets } from '../assets/ReferenceAssets';
import { assetsOptions } from '../assets/queries';
import { JobState, jobOptions, projectJobsOptions, useSubmitTranscription } from '../jobs';
import { selectPlayerAsset } from '../player';
import { useMessages } from '../preferences/Preferences';
import { capabilitiesOptions, CapabilityReadiness, operationReady } from '../runtime/capabilities';
import { transcriptionMessages } from './messages';
import './transcription.css';

export type TranscriptionSelection = { referenceAssetId?: string; jobId?: string };

export function Transcription({ projectId, selection, onSelect }: { projectId: string; selection: TranscriptionSelection; onSelect: (value: TranscriptionSelection) => void }) {
  const t = useMessages(transcriptionMessages);
  const assets = useQuery(assetsOptions(projectId));
  const jobs = useQuery(projectJobsOptions(projectId));
  const readiness = useQuery(capabilitiesOptions());
  const submit = useSubmitTranscription(projectId);
  const references = assets.data?.filter(asset => asset.kind === 'reference_audio') ?? [];
  const transcriptions = jobs.data?.filter(job => job.operation === 'Transcribe') ?? [];
  const jobId = selection.jobId ?? transcriptions.at(-1)?.id;
  const job = useQuery({ ...jobOptions(projectId, jobId ?? ''), enabled: Boolean(jobId) });
  const inputId = typeof job.data?.inputs.reference_asset_id === 'string' ? job.data.inputs.reference_asset_id : undefined;
  const referenceId = selection.referenceAssetId ?? inputId ?? references[0]?.id;
  const reference = references.find(asset => asset.id === referenceId);
  const profileSupported = reference?.sample_width_bits === 16 && reference.duration_seconds === 16
    && (reference.channels === 1 && reference.sample_rate === 24_000 || reference.channels === 2 && reference.sample_rate === 48_000);
  const failureCode = submit.error instanceof ApiFailure ? submit.error.detail?.code : undefined;
  const submissionMessage = failureCode?.includes('unconfirmed') || !(submit.error instanceof ApiFailure) ? t.unconfirmed
    : failureCode === 'runtime_unavailable' ? t.unavailable : failureCode?.includes('model') || failureCode === 'capability_missing' ? t.missing : t.inputFailure;
  function start(event: FormEvent) {
    event.preventDefault();
    if (!reference || !profileSupported || readiness.isError || !operationReady(readiness.data, 'Transcribe')) return;
    submit.mutate({ reference_asset_id: reference.id }, { onSuccess: value => onSelect({ referenceAssetId: reference.id, jobId: value.id }) });
  }
  return <><ReferenceAssets projectId={projectId} /><div className="workspace-grid"><section className="surface"><h2>{t.title}</h2><p className="hint">{t.intro}</p>
    <form onSubmit={start}><label>{t.reference}<select value={referenceId ?? ''} disabled={submit.isPending || references.length === 0} onChange={event => { onSelect({ ...selection, referenceAssetId: event.target.value }); submit.reset(); }}>
      {references.length === 0 ? <option value="">{t.empty}</option> : null}{references.map(asset => <option key={asset.id} value={asset.id}>{asset.original_name} · {asset.duration_seconds} {t.seconds}</option>)}
    </select></label>
    {assets.isPending ? <Loading /> : assets.isError ? <ErrorNotice error={assets.error} onRetry={() => void assets.refetch()} /> : null}
    <p className="field-help">{t.profile}</p>{reference && !profileSupported ? <p className="error-box" role="alert">{t.unsupported}</p> : null}
    {reference ? <><label className="identity-label">{t.referenceId}<code>{reference.id}</code></label><button type="button" onClick={() => selectPlayerAsset({ projectId, assetId: reference.id, label: reference.original_name })}>{t.listen} ▶</button></> : null}
    <button className="primary" type="submit" disabled={!profileSupported || submit.isPending || !operationReady(readiness.data, 'Transcribe') || readiness.isError}>{submit.isPending ? t.submitting : t.start} →</button>
    {submit.isError ? <div className="error-box" role="alert"><strong>{t.failed}</strong><p>{submissionMessage}</p>{failureCode ? <small>{t.code}: <code>{failureCode}</code></small> : null}<button type="button" onClick={() => void jobs.refetch()}>{t.refresh}</button></div> : null}
    </form><div className="transcription-readiness"><CapabilityReadiness operation="Transcribe" /></div>
  </section><div><section className="surface soft"><h2>{t.result}</h2><p className="hint">{t.resultBody}</p>{job.data?.status === 'completed' && job.data.result?.score_id ? <Link className="button primary" to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: job.data.result.score_id }}>{t.openScore} →</Link> : null}</section>
    <section className="surface transcription-job"><div className="section-heading"><h2>{t.jobs}</h2><button type="button" onClick={() => void jobs.refetch()}>{t.refresh}</button></div>
    {jobs.isPending ? <Loading /> : jobs.isError ? <ErrorNotice error={jobs.error} onRetry={() => void jobs.refetch()} /> : transcriptions.length ? <div className="transcription-attempts">{transcriptions.map(value => <button type="button" key={value.id} aria-pressed={value.id === jobId} onClick={() => onSelect({ jobId: value.id, referenceAssetId: typeof value.inputs.reference_asset_id === 'string' ? value.inputs.reference_asset_id : undefined })}>{t.selectJob}<code>{value.id}</code></button>)}</div> : <p className="hint">{t.noJobs}</p>}
    {jobId ? <><label className="identity-label">{t.selectedInput}<code>{inputId}</code></label><JobState key={jobId} projectId={projectId} jobId={jobId} onRetry={next => onSelect({ jobId: next.id, referenceAssetId: typeof next.inputs.reference_asset_id === 'string' ? next.inputs.reference_asset_id : referenceId })} /></> : null}
    </section>
  </div></div></>;
}
