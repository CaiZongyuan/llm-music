import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type { components } from '@llm-music/api-client';
import { ErrorNotice, Loading } from '../../components/States';
import { assetOptions } from '../assets/queries';
import { JobState, jobOptions } from '../jobs';
import { selectPlayerAsset } from '../player';
import { useMessages } from '../preferences/Preferences';
import { scoreMessages } from './messages';
import { abcOptions, scoreOptions } from './queries';
import { ScoreEditor } from './ScoreEditor';
import { ScoreDownload } from './ScoreDownload';
import './scores.css';

function ReferenceSource({ projectId, assetId }: { projectId: string; assetId: string }) {
  const t = useMessages(scoreMessages);
  const asset = useQuery(assetOptions(projectId, assetId));
  if (asset.isPending) return <Loading />;
  if (asset.isError) return <ErrorNotice error={asset.error} onRetry={() => void asset.refetch()} />;
  return <div className="score-source"><strong>{asset.data.original_name}</strong><small>{t.reference}</small><label className="identity-label">{t.referenceId}<code>{assetId}</code></label><button type="button" onClick={() => selectPlayerAsset({ projectId, assetId, label: asset.data.original_name })}>{t.listen} ▶</button></div>;
}
function SavedScore({ score, branchVersionId }: { score: components['schemas']['ScoreRead']; branchVersionId?: string }) {
  const t = useMessages(scoreMessages);
  const abc = useQuery(abcOptions(score.project_id, score.abc_asset_id));
  const job = useQuery({ ...jobOptions(score.project_id, score.job_id ?? ''), enabled: Boolean(score.job_id) });
  // MIDI belongs to this producer Job, rather than any other Score in the Project.
  const midiId = job.data?.result?.score_id === score.id ? job.data.result.midi_asset_id : undefined;
  return <>{abc.isPending ? <Loading /> : abc.isError ? <ErrorNotice error={abc.error} onRetry={() => void abc.refetch()} /> : <ScoreEditor projectId={score.project_id} score={score} initialABC={abc.data} branchVersionId={branchVersionId} />}
    <div className="workspace-grid"><section className="surface"><div className="section-heading"><h2>{t.original}</h2><span className="tag">{t.readonly}</span></div>
    <p className="hint">{t.savedIntro}</p><div className="score-actions">
      {score.job_id && job.isPending ? <Loading /> : score.job_id && job.isError ? <ErrorNotice error={job.error} onRetry={() => void job.refetch()} /> : midiId ? <ScoreDownload key={midiId} projectId={score.project_id} assetId={midiId} kind="midi" /> : <p className="hint">{t.missingMidi}</p>}
      <ScoreDownload key={score.abc_asset_id} projectId={score.project_id} assetId={score.abc_asset_id} kind="abc" />
    </div><small>{t.later}</small>
  </section><section className="surface soft"><h2>{t.abc}</h2>{abc.data !== undefined ? <pre className="score-code">{abc.data}</pre> : null}
    <h3>{t.source}</h3>{score.source_reference_asset_id ? <ReferenceSource projectId={score.project_id} assetId={score.source_reference_asset_id} /> : <p>{score.job_id ? t.generated : t.independent}</p>}
    {score.source_score_id ? <Link className="button" to="/projects/$projectId/scores/$scoreId" params={{ projectId: score.project_id, scoreId: score.source_score_id }}>{t.sourceScore}</Link> : null}
    <label className="identity-label">{t.identity}<code>{score.id}</code></label>{score.job_id ? <label className="identity-label">{t.job}<code>{score.job_id}</code></label> : null}
  </section></div>{score.job_id ? <section className="surface"><h2>{t.job}</h2><JobState projectId={score.project_id} jobId={score.job_id} /></section> : <p className="hint">{t.independent}</p>}</>;
}
export function ScoreReader({ projectId, scoreId, branchVersionId }: { projectId: string; scoreId: string; branchVersionId?: string }) {
  const t = useMessages(scoreMessages);
  const score = useQuery(scoreOptions(projectId, scoreId));
  const originKey = branchVersionId === undefined ? 'ordinary' : `version/${branchVersionId}`;
  return <><Link className="button score-back" to="/projects/$projectId/scores" params={{ projectId }}>← {t.back}</Link>
    {score.isPending ? <Loading /> : score.isError ? <ErrorNotice error={score.error} onRetry={() => void score.refetch()} /> : <SavedScore key={`${score.data.id}/${originKey}`} score={score.data} branchVersionId={branchVersionId} />}</>;
}
