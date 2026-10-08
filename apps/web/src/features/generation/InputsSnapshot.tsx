import { Link } from '@tanstack/react-router';
import type { GenerateCreate, GenerateFromScoreCreate } from '@llm-music/api-client';
import { useMessages } from '../preferences/Preferences';
import { generationMessages } from './messages';
import { ParentVersionLink } from '../versions/ParentVersionLink';
import './generation.css';

export function InputsSnapshot({ projectId, inputs, provenance }: { projectId: string; inputs: GenerateCreate | GenerateFromScoreCreate; provenance: Record<string, unknown> }) {
  const t = useMessages(generationMessages);
  return <><details className="input-snapshot"><summary>{t.inputSnapshot}</summary><h3>{t.style}</h3><p>{inputs.style}</p><h3>{t.lyrics}</h3><pre className="lyric-text">{inputs.lyrics}</pre><p>{t.seed}: {inputs.seed} · {t.duration}</p>
    {'source_score_id' in inputs ? <><p>{t.sourceScore}: <Link to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: inputs.source_score_id }}>{t.openSourceScore}</Link></p><p>{t.parentVersion}: <ParentVersionLink projectId={projectId} versionId={inputs.parent_version_id} /></p><h3>{t.submittedABC}</h3><pre className="score-code" data-submitted-abc>{inputs.abc}</pre></> : null}
    </details>
    <details className="record-details"><summary>{t.provenance}</summary><pre>{JSON.stringify(provenance, null, 2)}</pre></details></>;
}
