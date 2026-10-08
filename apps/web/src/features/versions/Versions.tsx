import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ErrorNotice, Loading } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { selectPlayerAsset } from '../player';
import { versionsOptions } from './queries';
import { versionMessages } from './messages';
import '../generation/generation.css';

export function Versions({ projectId }: { projectId: string }) {
  const t = useMessages(versionMessages);
  const versions = useQuery(versionsOptions(projectId));
  return <section className="surface"><div className="section-heading"><h2>{t.title}</h2><button type="button" onClick={() => void versions.refetch()}>{t.reload}</button></div><p className="hint">{t.intro}</p>
    {versions.isPending ? <Loading /> : versions.isError ? <ErrorNotice error={versions.error} onRetry={() => void versions.refetch()} /> : !versions.data.length ? <div className="empty"><h3>{t.empty}</h3><p>{t.emptyBody}</p><Link className="button" to="/projects/$projectId/generate" params={{ projectId }} search={{}}>{t.generate}</Link></div> : <ul className="version-list">{[...versions.data].reverse().map(version => <li key={version.id} className="version-row" data-version-id={version.id}><h3>{version.name}</h3><p className="field-help">{version.inputs.style}</p><div className="feature-actions"><button type="button" onClick={() => selectPlayerAsset({ projectId, assetId: version.audio_asset_id, label: version.name })}>{t.listen}</button><Link className="button" to="/projects/$projectId/versions/$versionId" params={{ projectId, versionId: version.id }}>{t.inspect}</Link></div><code>{version.id}</code></li>)}</ul>}
  </section>;
}

