import { Link } from '@tanstack/react-router';
import type { components } from '@llm-music/api-client';
import { useMessages } from '../preferences/Preferences';
import { generationMessages } from './messages';
import { ParentVersionLink } from '../versions/ParentVersionLink';
import './generation.css';

export function InputsSnapshot({ projectId, inputs, provenance }: { projectId: string; inputs: components['schemas']['CandidateRead']['inputs']; provenance: Record<string, unknown> }) {
  const t = useMessages(generationMessages);
  const selected = provenance.selected_score && typeof provenance.selected_score === 'object' ? provenance.selected_score as Record<string, unknown> : null;
  const origin = provenance.cover_source && typeof provenance.cover_source === 'object' ? provenance.cover_source as Record<string, unknown> : null;
  return <><details className="input-snapshot"><summary>{t.inputSnapshot}</summary><h3>{t.style}</h3><p>{inputs.style}</p><h3>{t.lyrics}</h3><pre className="lyric-text">{inputs.lyrics}</pre><p>{t.seed}: {inputs.seed} · {t.duration}</p>
    {'source_score_id' in inputs ? <><p>{t.sourceScore}: <Link to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: inputs.source_score_id }}>{t.openSourceScore}</Link></p><p>{t.parentVersion}: <ParentVersionLink projectId={projectId} versionId={inputs.parent_version_id} /></p><h3>{t.submittedABC}</h3><pre className="score-code" data-submitted-abc>{inputs.abc}</pre></> : null}
    {'mode' in inputs ? <><p>{t.coverMode}: <strong>{inputs.mode}</strong></p><p>{t.reference}: <Link to="/projects/$projectId" params={{ projectId }}><code>{inputs.reference_asset_id}</code></Link></p>
      {typeof origin?.transcribed_score_id === 'string' ? <p>{t.transcribedSource}: <Link to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: origin.transcribed_score_id }}>{t.openSourceScore}</Link></p> : null}
      <h3>{t.effectiveABC}</h3>{typeof selected?.effective_abc === 'string' ? <pre className="score-code" data-effective-abc>{selected.effective_abc}</pre> : null}<small>{inputs.effective_abc_sha256}</small></> : null}
    </details>
    <details className="record-details"><summary>{t.provenance}</summary><pre>{JSON.stringify(provenance, null, 2)}</pre></details></>;
}
