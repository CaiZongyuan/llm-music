import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import type WaveSurfer from 'wavesurfer.js';
import type RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { api, dataOf } from '../../lib/api';
import { assetOptions } from '../assets/queries';
import { versionsOptions } from '../versions/queries';
import { useMessages, usePreferences } from '../preferences/Preferences';
import { compareChoice, invalidateCompareChoice, playerMediaKey, playerSelection, publishScorePlayback, selectPlayerCompare, subscribePlayerSelection, type PlayerScoreSelection, type PlayerSelection } from './index';
import { playerMessages } from './messages';
import './player.css';

const waveModuleUrl = new URL('../../../node_modules/wavesurfer.js/dist/wavesurfer.esm.js', import.meta.url).href;
const regionsModuleUrl = new URL('../../../node_modules/wavesurfer.js/dist/plugins/regions.esm.js', import.meta.url).href;
type ListeningRegion = { start: number; end: number };

function clock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
function waveColors() {
  const style = getComputedStyle(document.documentElement), accent = style.getPropertyValue('--accent').trim();
  return { waveColor: style.getPropertyValue('--muted').trim(), progressColor: accent, cursorColor: accent };
}
function loadPlayerModules(attempt: number): Promise<[typeof import('wavesurfer.js'), typeof import('wavesurfer.js/dist/plugins/regions.esm.js')]> {
  function resource(url: string) {
    const value = new URL(url, document.baseURI);
    // Failed ESM imports are cached by URL. Retry the same pinned bundles at a fresh address.
    if (attempt) value.searchParams.set('player_retry', String(attempt));
    return value.href;
  }
  return Promise.all([import(/* @vite-ignore */ resource(waveModuleUrl)), import(/* @vite-ignore */ resource(regionsModuleUrl))]);
}
function playableMedia(element: HTMLAudioElement): Promise<void> {
  const playable = () => element.readyState >= 2 && !element.seeking && Number.isFinite(element.duration) && element.duration > 0;
  if (element.error) return Promise.reject(new Error('Native audio cannot play'));
  if (playable()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error('Native audio did not become playable')), 5_000);
    const events = ['loadeddata', 'canplay', 'seeked'];
    function finish(error?: Error) {
      clearTimeout(timer); events.forEach(name => element.removeEventListener(name, loaded)); element.removeEventListener('error', failed);
      if (error) reject(error); else resolve();
    }
    function loaded() { if (playable()) finish(); }
    function failed() { finish(new Error('Native audio cannot play')); }
    events.forEach(name => element.addEventListener(name, loaded)); element.addEventListener('error', failed, { once: true });
  });
}
function validRegion(value: ListeningRegion, limit: number) {
  return Number.isFinite(value.start) && Number.isFinite(value.end) && value.start >= 0 && value.start < value.end && value.end <= limit;
}

export function Player() {
  const selection = useSyncExternalStore(subscribePlayerSelection, playerSelection);
  const projectId = selection?.projectId ?? '', key = playerMediaKey(selection);
  const choice = useSyncExternalStore(subscribePlayerSelection, () => compareChoice(projectId));
  const compare = selection?.kind === 'compare' ? selection : null;
  const t = useMessages(playerMessages), { theme } = usePreferences();
  const container = useRef<HTMLDivElement>(null), media = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<WaveSurfer | null>(null), regions = useRef<RegionsPlugin | null>(null);
  const loaded = useRef<{ key: string; source: string; score: PlayerScoreSelection | null } | null>(null);
  const previous = useRef<PlayerSelection | null>(null);
  const intent = useRef({ time: 0, playing: false, bounded: false });
  const region = useRef<ListeningRegion | null>(null), limit = useRef(0);
  const loadQueue = useRef(Promise.resolve());
  const [initializationAttempt, setInitializationAttempt] = useState(0), [initializationFailed, setInitializationFailed] = useState(false);
  const [wave, setWave] = useState<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false), [continuation, setContinuation] = useState(false);
  const [time, setTime] = useState(0), [duration, setDuration] = useState(0);
  const [start, setStart] = useState('0'), [end, setEnd] = useState('0');
  const [regionInvalid, setRegionInvalid] = useState(false), [regionReset, setRegionReset] = useState(false);
  const [hasRegion, setHasRegion] = useState(false);
  const versions = useQuery({ ...versionsOptions(projectId), enabled: Boolean(compare) });
  const version = compare ? versions.data?.find(value => value.id === compare.pair[compare.pair.side] && value.project_id === projectId && value.audio_asset_id) : null;
  const other = compare?.pair.b ? versions.data?.find(value => value.id === compare.pair[compare.pair.side === 'a' ? 'b' : 'a'] && value.project_id === projectId && value.audio_asset_id) : null;
  const comparisonValid = !compare || Boolean(version && (!compare.pair.b || other) && compare.pair.a !== compare.pair.b && !versions.isError);
  const assetId = selection?.kind === 'score' ? '' : selection?.kind === 'compare' ? comparisonValid ? version?.audio_asset_id ?? '' : '' : selection?.assetId ?? '';
  const isAsset = Boolean(selection && selection.kind !== 'score' && assetId);
  const asset = useQuery({ ...assetOptions(projectId, assetId), enabled: isAsset });
  const otherAsset = useQuery({ ...assetOptions(projectId, other?.audio_asset_id ?? ''), enabled: Boolean(compare && comparisonValid && other) });
  const content = useQuery({ queryKey: ['projects', projectId, 'assets', assetId, 'playback-content'], enabled: isAsset,
    queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { project_id: projectId, asset_id: assetId } }, parseAs: 'blob', signal })),
    staleTime: Infinity, gcTime: 60_000, retry: false });
  const knownLength = selection?.kind === 'score' ? selection.durationSeconds : asset.data?.duration_seconds ?? 0;
  const currentReady = ready && loaded.current?.key === key && comparisonValid;
  const activeLength = currentReady ? duration : knownLength;
  const regionLimit = compare?.pair.b ? Math.min(activeLength, otherAsset.data?.duration_seconds ?? 0) : activeLength;
  const readFailed = Boolean(compare && versions.isError || isAsset && (asset.isError || content.isError));
  const pairMissing = Boolean(compare && versions.isSuccess && !comparisonValid);
  const label = compare ? `${compare.pair.side.toUpperCase()} · ${version?.name ?? t.chooseVersion}` : selection && selection.kind !== 'compare' ? selection.label : t.empty;
  const record = compare ? { kind: 'version', id: compare.pair[compare.pair.side] } : selection && selection.kind !== 'score' && selection.kind !== 'compare' ? selection.record : null;

  function showRegion() {
    regions.current?.clearRegions();
    const available = Boolean(region.current && validRegion(region.current, limit.current));
    setHasRegion(available);
    if (available && region.current) regions.current?.addRegion({ id: 'listening', ...region.current, color: 'color-mix(in srgb, var(--accent) 20%, transparent)', drag: true, resize: true, minLength: Math.min(0.1, limit.current) });
  }
  function failPlayback() {
    intent.current.playing = false; intent.current.bounded = false; loaded.current = null;
    publishScorePlayback(null); waveRef.current?.pause(); setReady(false); setPlaying(false); setContinuation(false); setFailed(true);
  }
  useEffect(() => {
    const element = media.current;
    if (!element) return;
    function owned() { return loaded.current?.key === playerMediaKey(playerSelection()) && loaded.current?.source === element?.currentSrc; }
    function sync(event: Event) {
      if (!owned() || !element) { if (event.type === 'play') element?.pause(); return; }
      if (!intent.current.playing && !element.paused) { element.pause(); return; }
      if (intent.current.bounded && region.current && element.currentTime >= region.current.end) {
        intent.current.bounded = false; intent.current.playing = false; element.pause(); waveRef.current?.setTime(region.current.end);
      }
      intent.current.time = element.currentTime; intent.current.playing = !element.paused && !element.ended;
      setTime(element.currentTime); setPlaying(intent.current.playing); setContinuation(false);
      const score = loaded.current?.score;
      publishScorePlayback(score ? { projectId: score.projectId, abcSha256: score.abcSha256, time: element.currentTime, playing: intent.current.playing } : null);
    }
    function errored() { if (owned()) failPlayback(); }
    const events = ['timeupdate', 'play', 'pause', 'seeking', 'seeked', 'ended'];
    events.forEach(name => element.addEventListener(name, sync)); element.addEventListener('error', errored);
    return () => { events.forEach(name => element.removeEventListener(name, sync)); element.removeEventListener('error', errored); publishScorePlayback(null); };
  }, []);
  useEffect(() => {
    let disposed = false;
    let instance: WaveSurfer | undefined;
    void loadPlayerModules(initializationAttempt).then(([library, plugin]) => {
      if (disposed || !container.current || !media.current) return;
      const regionPlugin = plugin.default.create(); regions.current = regionPlugin;
      instance = library.default.create({ container: container.current, media: media.current, height: 52, normalize: true, ...waveColors(), plugins: [regionPlugin] });
      waveRef.current = instance;
      instance.on('timeupdate', () => {
        const element = media.current;
        if (!element || loaded.current?.key !== playerMediaKey(playerSelection()) || loaded.current.source !== element.currentSrc) return;
        // An SDK event can retain the previous end during a native seek. The audio element owns time.
        const value = element.currentTime;
        setTime(value);
        if (intent.current.bounded && region.current && value >= region.current.end) {
          intent.current.bounded = false; intent.current.playing = false; instance?.pause(); instance?.setTime(region.current.end);
        }
      });
      instance.on('interaction', () => { intent.current.bounded = false; });
      regionPlugin.on('region-update', () => { intent.current.bounded = false; });
      regionPlugin.on('region-updated', updated => {
        intent.current.bounded = false;
        const proposed = { start: updated.start, end: updated.end };
        if (!validRegion(proposed, limit.current)) { if (region.current) updated.setOptions(region.current); setRegionInvalid(true); return; }
        region.current = proposed; setStart(proposed.start.toFixed(2)); setEnd(proposed.end.toFixed(2)); setRegionInvalid(false); setRegionReset(false);
      });
      setWave(instance);
    }).catch(() => { if (!disposed) setInitializationFailed(true); });
    return () => { disposed = true; if (waveRef.current === instance) waveRef.current = null; loaded.current = null; instance?.destroy(); regions.current = null; };
  }, [initializationAttempt]);
  useEffect(() => {
    const earlier = previous.current;
    const continuing = selection?.kind === 'compare' && selection.preserveTime && earlier?.kind === 'compare' && earlier.projectId === selection.projectId && earlier.pair.a === selection.pair.a && earlier.pair.b === selection.pair.b;
    const wasReady = loaded.current?.key === playerMediaKey(earlier);
    intent.current = continuing ? { time: wasReady ? media.current?.currentTime ?? 0 : intent.current.time, playing: wasReady ? Boolean(media.current && !media.current.paused && !media.current.ended) : intent.current.playing, bounded: intent.current.bounded }
      : { time: 0, playing: selection?.kind === 'score', bounded: false };
    if (!compare || earlier?.kind !== 'compare' || earlier.projectId !== projectId) { region.current = null; setHasRegion(false); setStart('0'); setEnd('0'); setRegionReset(false); setRegionInvalid(false); }
    previous.current = selection; loaded.current = null; publishScorePlayback(null); wave?.pause(); regions.current?.clearRegions();
    setReady(false); setFailed(false); setPlaying(false); setContinuation(intent.current.playing); setTime(intent.current.time); setDuration(0);
  }, [wave, key]);
  useEffect(() => {
    limit.current = regionLimit;
    if (region.current && regionLimit > 0 && !validRegion(region.current, regionLimit)) { region.current = null; setHasRegion(false); intent.current.bounded = false; regions.current?.clearRegions(); setRegionReset(true); }
    else if (loaded.current?.key === key && region.current) showRegion();
  }, [regionLimit]);
  useEffect(() => {
    if (readFailed || pairMissing) { failPlayback(); if (pairMissing) invalidateCompareChoice(projectId); }
  }, [readFailed, pairMissing, projectId]);
  useEffect(() => {
    if (!wave || !selection || !comparisonValid || readFailed) return;
    const score = selection.kind === 'score' ? selection : null, blob = score?.blob ?? content.data;
    if (!blob || !knownLength || !Number.isFinite(knownLength)) return;
    let disposed = false;
    const owned = () => !disposed && waveRef.current === wave && playerMediaKey(playerSelection()) === key;
    // Decoder work cannot be aborted. Serialize loads; only the current request may publish or play.
    loadQueue.current = loadQueue.current.then(async () => {
      if (!owned() || !media.current) return;
      loaded.current = null; wave.pause(); setReady(false);
      try {
        // A validated duration bypasses corrupt files' missing metadata; actual bytes are still decoded.
        await wave.loadBlob(blob, undefined, knownLength);
        if (!owned()) return;
        await playableMedia(media.current);
        if (!owned()) return;
        const length = media.current.duration;
        let position = 0;
        // A seek made while loading wins over the earlier captured position.
        while (owned()) {
          position = Math.min(intent.current.time, length);
          if (position >= length || intent.current.bounded && region.current && position >= region.current.end) { intent.current.playing = false; intent.current.bounded = false; }
          wave.setTime(position); await playableMedia(media.current);
          if (!owned()) return;
          if (Math.min(intent.current.time, length) === position) break;
        }
        if (!owned()) return;
        intent.current.time = position; loaded.current = { key, source: media.current.currentSrc, score };
        setTime(position); setDuration(length); setReady(true); setFailed(false);
        if (!compare && !region.current) { region.current = { start: 0, end: Math.min(10, length) }; setStart('0'); setEnd(String(region.current.end)); }
        if (!compare?.pair.b) limit.current = length;
        if (region.current && limit.current > 0 && !validRegion(region.current, limit.current)) { region.current = null; intent.current.bounded = false; setRegionReset(true); }
        showRegion();
        if (intent.current.playing) { await wave.play(); if (owned() && !intent.current.playing) wave.pause(); }
      } catch { if (owned()) failPlayback(); }
    });
    return () => { disposed = true; };
  }, [wave, key, content.data, knownLength, comparisonValid, readFailed]);
  useEffect(() => { wave?.setOptions(waveColors()); }, [wave, theme]);

  function pause() { intent.current.playing = false; intent.current.bounded = false; wave?.pause(); setPlaying(false); setContinuation(false); }
  async function play(regionOnly = false) {
    if (!wave || !currentReady) return;
    if (regionOnly && (!region.current || !validRegion(region.current, limit.current))) { setRegionInvalid(true); return; }
    intent.current.bounded = regionOnly; intent.current.playing = true;
    if (regionOnly && region.current) wave.setTime(region.current.start);
    else if (media.current?.ended || (media.current?.currentTime ?? 0) >= duration) wave.setTime(0);
    try { await wave.play(); if (playerMediaKey(playerSelection()) === key && !intent.current.playing) wave.pause(); }
    catch { if (playerMediaKey(playerSelection()) === key) failPlayback(); }
  }
  function seek(value: number) {
    intent.current.bounded = false; intent.current.time = Math.max(0, Math.min(value, currentReady ? duration : knownLength));
    if (currentReady) wave?.setTime(intent.current.time);
    setTime(intent.current.time);
  }
  function applyRegion() {
    const proposed = { start: Number(start), end: Number(end) };
    if (!start.trim() || !end.trim() || !validRegion(proposed, limit.current)) { setRegionInvalid(true); return; }
    region.current = proposed; intent.current.bounded = false; setRegionInvalid(false); setRegionReset(false); showRegion();
  }
  function reread() {
    pause(); loaded.current = null; setReady(false); setFailed(false);
    if (!wave || selection?.kind === 'score') { setInitializationFailed(false); setInitializationAttempt(attempt => attempt + 1); }
    if (compare) { void versions.refetch(); if (other) void otherAsset.refetch(); }
    if (isAsset) { void content.refetch(); void asset.refetch(); }
  }
  const pausing = playing || continuation;
  const controlsFailed = failed || readFailed || pairMissing || initializationFailed;
  const seekAvailable = Boolean(selection && !controlsFailed && (currentReady || compare && comparisonValid && knownLength > 0));

  return <footer id="persistent-player" className="continuous-player" aria-label={t.player} data-listening-id={record?.id} data-listening-kind={record?.kind}>
    <audio ref={media} hidden preload="metadata" />
    <div className="player-title"><strong>{label}</strong><small>{selection?.kind === 'score' ? `${t.scoreTone} · r${selection.revision}` : compare ? t.compare : selection ? asset.data?.kind === 'reference_audio' ? t.source : t.player : t.emptyHelp}</small>
      {compare ? <div className="player-compare-actions"><button type="button" aria-pressed={compare.pair.side === 'a'} onClick={() => selectPlayerCompare(projectId, { ...compare.pair, side: 'a' }, true)}>{t.switchA}</button><button type="button" disabled={!compare.pair.b} aria-pressed={compare.pair.side === 'b'} onClick={() => selectPlayerCompare(projectId, { ...compare.pair, side: 'b' }, true)}>{t.switchB}</button></div>
        : choice.pair ? <button type="button" className="return-compare" onClick={() => { if (choice.pair) selectPlayerCompare(projectId, choice.pair); }}>{t.returnCompare}</button> : null}
      {record ? <details className="player-record"><summary>{record.kind === 'candidate' ? t.candidate : t.savedVersion}</summary><code>{record.id}</code></details> : null}
    </div>
    <div className="player-main"><button type="button" disabled={!selection || controlsFailed || !currentReady && !continuation} onClick={() => pausing ? pause() : void play()} aria-label={pausing ? t.pause : t.play}>{pausing ? 'Ⅱ' : '▶'}</button>
      <div className="wave-container" style={{ visibility: currentReady ? 'visible' : 'hidden' }} ref={container} /><output aria-label={t.clock}>{clock(time)} / {clock(currentReady ? duration : knownLength)}</output>
      <label className="seek-label"><span className="visually-hidden">{t.seek}</span><input type="range" aria-label={t.seek} min={0} max={currentReady ? duration : knownLength} step={0.1} value={time} disabled={!seekAvailable} onChange={event => seek(Number(event.target.value))} /></label>
    </div>
    {controlsFailed ? <div className="player-error" role="alert"><span>{initializationFailed ? t.unavailable : pairMissing ? t.pairLost : compare && versions.isError ? t.pairReadFailed : t.failed}</span><button type="button" onClick={reread}>{t.retry}</button>{compare ? <Link to="/projects/$projectId/versions" params={{ projectId }}>{t.choosePair}</Link> : null}</div> : selection && !currentReady ? <small role="status">{t.loading}</small> : currentReady && time >= duration ? <small role="status">{t.ended}</small> : null}
    {compare && choice.notice === 'storage' ? <p className="player-notice" role="alert">{t.storageWarning}</p> : null}
    {compare ? <p className="player-notice">{t.refreshRule}</p> : null}
    {selection ? <details className="player-regions"><summary>{compare?.pair.b ? t.commonRegion : t.region}</summary><div className="region-fields"><label>{t.start}<input type="number" step="0.1" min="0" max={regionLimit} value={start} onChange={event => setStart(event.target.value)} /></label><label>{t.end}<input type="number" step="0.1" min="0" max={regionLimit} value={end} onChange={event => setEnd(event.target.value)} /></label><button type="button" disabled={!currentReady || !regionLimit} onClick={applyRegion}>{t.apply}</button><button type="button" disabled={!currentReady || !hasRegion || regionReset} onClick={() => void play(true)}>{t.playRegion}</button></div>{regionInvalid ? <p role="alert">{compare?.pair.b ? t.invalidCommonRegion : t.invalidRegion}</p> : null}{regionReset ? <p role="alert">{t.regionReset}</p> : null}<p className="field-help">{t.regionRule}</p></details> : null}
  </footer>;
}
