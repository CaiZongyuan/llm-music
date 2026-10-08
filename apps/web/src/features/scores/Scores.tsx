import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorNotice, Loading } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { scoreMessages } from './messages';
import { scoresOptions } from './queries';
import { ScoreEditor } from './ScoreEditor';
import exampleABC from './example.txt?raw';
import './scores.css';

export function Scores({ projectId }: { projectId: string }) {
  const t = useMessages(scoreMessages);
  const scores = useQuery(scoresOptions(projectId));
  const [example, setExample] = useState(false);
  if (example) return <><button type="button" className="score-back" onClick={() => setExample(false)}>← {t.back}</button><ScoreEditor projectId={projectId} initialABC={exampleABC} /></>;
  return <section className="surface"><div className="section-heading"><h2>{t.list}</h2><button type="button" onClick={() => void scores.refetch()}>{t.refresh}</button></div>
    {scores.isPending ? <Loading /> : scores.isError ? <ErrorNotice error={scores.error} onRetry={() => void scores.refetch()} /> : scores.data.length === 0
      ? <div className="empty"><span className="empty-mark" aria-hidden="true">♪</span><h3>{t.empty}</h3><p>{t.emptyBody}</p><div className="score-actions"><button type="button" onClick={() => setExample(true)}>{t.example}</button><Link className="button" to="/projects/$projectId/transcribe" params={{ projectId }}>{t.transcribe}</Link></div></div>
      : <><button type="button" className="score-back" onClick={() => setExample(true)}>{t.example}</button><ul className="score-list">{scores.data.map((score, index) => <li key={score.id}><div><h3>{t.score} {index + 1}</h3><small>{score.job_id === null ? t.editedScore : score.source_reference_asset_id ? t.referenceScore : t.generatedScore}</small><code>{score.id}</code></div><Link className="button" to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: score.id }}>{t.open} →</Link></li>)}</ul></>}
  </section>;
}
