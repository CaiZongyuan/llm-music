import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ErrorNotice, Loading } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { selectPlayerAsset } from '../player';
import { InputsSnapshot } from '../generation/InputsSnapshot';
import { generationMessages } from '../generation/messages';
import { versionOptions } from './queries';
import { versionMessages } from './messages';
import { ParentVersionLink } from './ParentVersionLink';
import { VersionInputReuse } from './VersionInputReuse';
import '../generation/generation.css';
import './versions.css';

export function Version({ projectId, versionId }: { projectId: string; versionId: string }) {
  const t = useMessages(versionMessages);
  const generation = useMessages(generationMessages);
  const version = useQuery(versionOptions(projectId, versionId));
  if (version.isPending) return <Loading />;
  if (version.isError) return <ErrorNotice error={version.error} onRetry={() => void version.refetch()} />;
  const value = version.data;
  return <section className="surface version-detail" aria-label={t.details} data-version-id={value.id}><span className="tag">{t.details}</span><h2>{value.name}</h2><div className="feature-actions"><button type="button" className="primary" onClick={() => selectPlayerAsset({ projectId, assetId: value.audio_asset_id, label: value.name, record: { kind: 'version', id: value.id } })}>{t.listen}</button><Link className="button" to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: value.score_id }}>{generation.score}</Link><Link className="button" to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: value.score_id }} search={{ branchVersionId: value.id }}>{t.branch}</Link><VersionInputReuse version={value} /></div>
    {value.provenance.runtime_kind === 'fake' ? <p className="field-help">{t.fake}</p> : null}
    <InputsSnapshot projectId={projectId} inputs={value.inputs} provenance={value.provenance} /><dl className="facts"><dt>{t.created}</dt><dd>{value.created_at}</dd><dt>{t.candidate}</dt><dd><code>{value.candidate_id}</code></dd><dt>{t.parent}</dt><dd><ParentVersionLink projectId={projectId} versionId={value.parent_version_id} /></dd></dl>
    <section className="version-outputs" aria-label={t.outputs}><h3>{t.outputs}</h3><p className="hint">{t.savedSnapshot}</p><dl className="facts"><dt>{t.outputAudio}</dt><dd><code>{value.audio_asset_id}</code></dd><dt>{t.outputScore}</dt><dd><Link to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: value.score_id }}><code>{value.score_id}</code></Link></dd></dl><details className="record-details"><summary>{t.outputRecord}</summary><pre>{JSON.stringify(value.output_snapshot, null, 2)}</pre></details></section>
    <details className="record-details"><summary>{generation.record}</summary><code>{value.id}</code><code>{value.job_id}</code><code>{value.audio_asset_id}</code><code>{value.score_id}</code></details>
  </section>;
}
