import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ErrorNotice, Loading } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { scoreMessages } from './messages';
import { scoresOptions } from './queries';
import './scores.css';

export function Scores({ projectId }: { projectId: string }) {
  const t = useMessages(scoreMessages);
  const scores = useQuery(scoresOptions(projectId));
  return <section className="surface"><div className="section-heading"><h2>{t.list}</h2><button type="button" onClick={() => void scores.refetch()}>{t.refresh}</button></div>
    {scores.isPending ? <Loading /> : scores.isError ? <ErrorNotice error={scores.error} onRetry={() => void scores.refetch()} /> : scores.data.length === 0
      ? <div className="empty"><span className="empty-mark" aria-hidden="true">♪</span><h3>{t.empty}</h3><p>{t.emptyBody}</p><Link className="button" to="/projects/$projectId/transcribe" params={{ projectId }}>{t.transcribe}</Link></div>
      : <ul className="score-list">{scores.data.map((score, index) => <li key={score.id}><div><h3>{t.score} {index + 1}</h3><small>{score.source_reference_asset_id ? t.referenceScore : t.generatedScore}</small><code>{score.id}</code></div><Link className="button" to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: score.id }}>{t.open} →</Link></li>)}</ul>}
  </section>;
}
