import type { components } from '@llm-music/api-client';
import { updateGenerationDraft } from '../generation/drafts';
import { useMessages } from '../preferences/Preferences';
import { versionMessages } from './messages';

export function VersionInputReuse({ version }: { version: components['schemas']['VersionRead'] }) {
  const t = useMessages(versionMessages);
  return <button type="button" onClick={() => updateGenerationDraft(version.project_id, {
    style: version.inputs.style, lyrics: version.inputs.lyrics, seed: String(version.inputs.seed),
  })}>{t.reuse}</button>;
}
