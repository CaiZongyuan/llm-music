import type { GenerateCreate } from '@llm-music/api-client';
import { useMessages } from '../preferences/Preferences';
import { generationMessages } from './messages';

export function InputsSnapshot({ inputs, provenance }: { inputs: GenerateCreate; provenance: Record<string, unknown> }) {
  const t = useMessages(generationMessages);
  return <><details className="input-snapshot"><summary>{t.inputSnapshot}</summary><h3>{t.style}</h3><p>{inputs.style}</p><h3>{t.lyrics}</h3><pre className="lyric-text">{inputs.lyrics}</pre><p>{t.seed}: {inputs.seed} · {t.duration}</p></details>
    <details className="record-details"><summary>{t.provenance}</summary><pre>{JSON.stringify(provenance, null, 2)}</pre></details></>;
}
