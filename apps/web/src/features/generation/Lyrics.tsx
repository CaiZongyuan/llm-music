import { Link } from '@tanstack/react-router';
import { useMessages } from '../preferences/Preferences';
import { generationMessages } from './messages';
import { useGenerationDraft } from './drafts';
import './generation.css';

export function Lyrics({ projectId }: { projectId: string }) {
  const t = useMessages(generationMessages);
  const [draft] = useGenerationDraft(projectId);
  return <div className="workspace-grid"><section className="surface"><h2>{t.draftTitle}</h2><p className="hint">{t.draftHelp}</p><pre className="lyric-text">{draft.lyrics || t.noLyrics}</pre><Link className="button" to="/projects/$projectId/generate" params={{ projectId }} search={{}}>{t.return}</Link></section><section className="surface soft"><h2>{t.direction}</h2><p>{draft.style}</p><p>{t.seed}: {draft.seed}</p></section></div>;
}
