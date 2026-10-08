import { useEffect, useRef, useState } from 'react';
import type { NoteTimingEvent } from 'abcjs';
import { loadABCJS } from '../scores/abcjs';
import { auditionMidi, downloadMidi, readMidi } from '../scores/midi';
import { scorePlayback, selectPlayerScore, subscribeScorePlayback, type ScorePlayback } from '../player';
import { useMessages } from '../preferences/Preferences';
import { coverMessages } from './messages';

type Rendered = { abc: string; host: HTMLDivElement; midi: Uint8Array; timings: NoteTimingEvent[] };
export function EffectiveScore({ projectId, abc, hash, revision, current, selected, onSelect }: {
  projectId: string; abc: string; hash: string; revision: number; current: boolean; selected: boolean; onSelect: () => void;
}) {
  const t = useMessages(coverMessages), notation = useRef<HTMLDivElement>(null);
  const [rendered, setRendered] = useState<Rendered | null>(null), [error, setError] = useState(false);
  const ready = current && rendered?.abc === abc && !error;
  useEffect(() => {
    let active = true; setError(false);
    void loadABCJS().then(library => {
      if (!active) return;
      const host = document.createElement('div');
      const [tune] = library.renderAbc(host, abc, { responsive: 'resize', add_classes: true, staffwidth: 470, wrap: { minSpacing: 1.5, maxSpacing: 2.7, preferredMeasuresPerLine: 4 } });
      if (!tune || tune.warnings?.length || !host.querySelector('svg')) throw new Error('No effective notation');
      const midi: unknown = library.synth.getMidiFile(tune, { midiOutputType: 'binary' });
      if (!(midi instanceof Uint8Array)) throw new Error('No effective MIDI');
      readMidi(midi); setRendered({ abc, host, midi, timings: new library.TimingCallbacks(tune).noteTimings });
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [abc]);
  useEffect(() => { if (rendered) notation.current?.replaceChildren(rendered.host); }, [rendered]);
  useEffect(() => {
    const clear = () => rendered?.host.querySelectorAll('.highlight').forEach(element => element.classList.remove('highlight'));
    const sync = (playback: ScorePlayback) => {
      clear(); if (!ready || !playback?.playing || playback.projectId !== projectId || playback.abcSha256 !== hash) return;
      const event = rendered?.timings.filter(item => item.milliseconds <= playback.time * 1000).at(-1);
      if (event?.type === 'event') event.elements?.flat().forEach(element => element?.classList.add('highlight'));
    };
    sync(scorePlayback()); const unsubscribe = subscribeScorePlayback(sync);
    return () => { unsubscribe(); clear(); };
  }, [rendered, ready, projectId, hash]);
  function audition() {
    if (!ready || !rendered) return;
    try { selectPlayerScore({ kind: 'score', projectId, id: `${hash}:${crypto.randomUUID()}`, label: `${t.effectiveABC} · melody`, revision, abcSha256: hash, ...auditionMidi(rendered.midi) }); } catch { setError(true); }
  }
  return <><div className="score-notation" role="img" aria-label={t.effectiveNotation} ref={notation} /><div className="score-actions">
    <button type="button" disabled={!ready} onClick={audition}>{t.auditionEffective}</button><button type="button" disabled={!ready} onClick={() => { if (rendered) { try { downloadMidi(rendered.midi, revision); } catch { setError(true); } } }}>{t.exportEffective}</button>
    <button type="button" className="primary" disabled={!ready || selected} onClick={onSelect}>{selected ? t.selectedEffective : t.selectEffective}</button></div>
    <p className="hint">{t.midiHelp}</p>{error ? <p className="error-box" role="alert">{t.renderFailed}</p> : null}</>;
}
