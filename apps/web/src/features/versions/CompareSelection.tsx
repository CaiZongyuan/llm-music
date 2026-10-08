import { useState } from 'react';
import type { components } from '@llm-music/api-client';
import { compareChoice, selectPlayerCompare } from '../player';
import { useMessages } from '../preferences/Preferences';
import { playerMessages } from '../player/messages';

export function CompareSelection({ projectId, versions }: { projectId: string; versions: components['schemas']['VersionRead'][] }) {
  const t = useMessages(playerMessages);
  const stored = compareChoice(projectId).pair;
  const [a, setA] = useState(stored?.a ?? versions[0]?.id ?? '');
  const [b, setB] = useState(stored?.b ?? versions[1]?.id ?? '');
  const [invalid, setInvalid] = useState(false);
  function apply() {
    const first = versions.find(value => value.id === a && value.project_id === projectId && value.audio_asset_id);
    const second = b ? versions.find(value => value.id === b && value.project_id === projectId && value.audio_asset_id) : null;
    if (!first || b && (!second || a === b)) { setInvalid(true); return; }
    setInvalid(false); selectPlayerCompare(projectId, { a, b: b || null, side: 'a' });
  }
  return <section className="compare-selection" aria-label={t.compare}><h3>{t.choosePair}</h3><div className="region-fields">
    <label>{t.versionA}<select value={a} onChange={event => setA(event.target.value)}><option value="">{t.chooseVersion}</option>{versions.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
    <label>{t.versionB}<select value={b} onChange={event => setB(event.target.value)}><option value="">{t.oneVersion}</option>{versions.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
    <button type="button" disabled={!versions.length} onClick={apply}>{t.applyPair}</button></div><p className="hint">{t.switchRule}</p>{invalid ? <p role="alert">{t.invalidPair}</p> : null}</section>;
}
