import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import type WaveSurfer from 'wavesurfer.js';
import type RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';
import { api, dataOf } from '../../lib/api';
import { assetOptions } from '../assets/queries';
import { versionsOptions } from '../versions/queries';
import { useMessages, usePreferences } from '../preferences/Preferences';
import { playerSelection, publishScorePlayback, selectPlayerCompare, subscribePlayerSelection, type PlayerScoreSelection } from './index';
import { playerMessages } from './messages';
import './player.css';

const waveModuleUrl = new URL('../../../node_modules/wavesurfer.js/dist/wavesurfer.esm.js', import.meta.url).href;
const regionsModuleUrl = new URL('../../../node_modules/wavesurfer.js/dist/plugins/regions.esm.js', import.meta.url).href;

function clock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
function waveColors() {
  const style = getComputedStyle(document.documentElement);
  const accent = style.getPropertyValue('--accent').trim();
  return { waveColor: style.getPropertyValue('--muted').trim(), progressColor: accent, cursorColor: accent };
}
function loadPlayerModules(attempt: number): Promise<[typeof import('wavesurfer.js'), typeof import('wavesurfer.js/dist/plugins/regions.esm.js')]> {
  function resource(url: string) {
    const value = new URL(url, document.baseURI);
    // Failed ESM imports are cached by URL. Retry the same pinned bundles with
    // a fresh address; Vite's asset URLs keep the self-contained SDKs in the build.
    if (attempt) value.searchParams.set('player_retry', String(attempt));
    return value.href;
  }
  return Promise.all([import(/* @vite-ignore */ resource(waveModuleUrl)), import(/* @vite-ignore */ resource(regionsModuleUrl))]);
}

export function Player() {
  const selection = useSyncExternalStore(subscribePlayerSelection, playerSelection);
  const t = useMessages(playerMessages);
  const { theme } = usePreferences();
  const container = useRef<HTMLDivElement>(null);
  const media = useRef<HTMLAudioElement>(null);
  const loadedScore = useRef<PlayerScoreSelection | null>(null);
  const regions = useRef<RegionsPlugin | null>(null);
  const loadQueue = useRef(Promise.resolve());
  const bounded = useRef(false);
  const [initializationAttempt, setInitializationAttempt] = useState(0);
  const [initializationFailed, setInitializationFailed] = useState(false);
  const [wave, setWave] = useState<WaveSurfer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('0');
  const [regionInvalid, setRegionInvalid] = useState(false);
  const projectId = selection?.projectId ?? '';
  const compare = selection?.kind === 'compare' ? selection : null;
  const versions = useQuery({ ...versionsOptions(projectId), enabled: Boolean(compare) });
  const version = compare ? versions.data?.find(value => value.id === compare.pair[compare.pair.side] && value.project_id === projectId) : null;
  const assetId = selection?.kind === 'score' ? '' : selection?.kind === 'compare' ? version?.audio_asset_id ?? '' : selection?.assetId ?? '';
  const selectionId = selection?.kind === 'score' ? selection.id : assetId;
  const isAsset = Boolean(selection && selection.kind !== 'score' && assetId);
  const asset = useQuery({ ...assetOptions(projectId, assetId), enabled: isAsset });
  const content = useQuery({ queryKey: ['projects', projectId, 'assets', assetId, 'playback-content'], enabled: isAsset,
    queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { project_id: projectId, asset_id: assetId } }, parseAs: 'blob', signal })),
    staleTime: Infinity, gcTime: 60_000, retry: false });

  useEffect(() => {
    const element = media.current;
    if (!element) return;
    function sync() {
      const score = loadedScore.current, current = playerSelection();
      publishScorePlayback(score && current?.kind === 'score' && current.id === score.id && element
        ? { projectId: score.projectId, abcSha256: score.abcSha256, time: element.currentTime, playing: !element.paused && !element.ended }
        : null);
    }
    const events = ['timeupdate', 'play', 'pause', 'seeking', 'seeked', 'ended', 'emptied', 'error'];
    events.forEach(name => element.addEventListener(name, sync));
    return () => { events.forEach(name => element.removeEventListener(name, sync)); publishScorePlayback(null); };
  }, []);

  useEffect(() => {
    let disposed = false;
    let instance: WaveSurfer | undefined;
    void loadPlayerModules(initializationAttempt).then(([library, plugin]) => {
      if (disposed || !container.current || !media.current) return;
      const regionPlugin = plugin.default.create();
      regions.current = regionPlugin;
      instance = library.default.create({ container: container.current, media: media.current, height: 52, normalize: true, ...waveColors(), plugins: [regionPlugin] });
      instance.on('play', () => setPlaying(true));
      instance.on('pause', () => setPlaying(false));
      instance.on('error', () => { setFailed(true); setReady(false); });
      instance.on('timeupdate', value => {
        setTime(value);
        const region = regionPlugin.getRegions()[0];
        if (bounded.current && region && value >= region.end) {
          bounded.current = false;
          instance?.pause();
          instance?.setTime(region.end);
        }
      });
      regionPlugin.on('region-updated', region => { setStart(region.start.toFixed(2)); setEnd(region.end.toFixed(2)); });
      setWave(instance);
    }).catch(() => { if (!disposed) setInitializationFailed(true); });
    return () => { disposed = true; instance?.destroy(); regions.current = null; };
  }, [initializationAttempt]);

  useEffect(() => {
    bounded.current = false;
    loadedScore.current = null; publishScorePlayback(null);
    wave?.pause(); setReady(false); setFailed(false); setPlaying(false); setTime(0); setDuration(0);
    regions.current?.clearRegions();
  }, [wave, projectId, selectionId]);

  useEffect(() => {
    if (!wave || !selection) return;
    const score = selection.kind === 'score' ? selection : null;
    const blob = score?.blob ?? content.data;
    const length = score?.durationSeconds ?? asset.data?.duration_seconds;
    if (!blob || !length) return;
    let disposed = false;
    // WaveSurfer decoding cannot be aborted. Serialize loads and publish only the
    // latest selection so an earlier decode cannot replace its waveform/regions.
    loadQueue.current = loadQueue.current.then(async () => {
      if (disposed) return;
      try {
        if (!length || !Number.isFinite(length)) throw new Error('Audio duration is unavailable');
        await wave.loadBlob(blob, undefined, length);
        if (disposed) return;
        loadedScore.current = score;
        setDuration(length); setReady(true); setFailed(false);
        regions.current?.clearRegions();
        regions.current?.addRegion({ id: 'listening', start: 0, end: Math.min(10, length), color: 'color-mix(in srgb, var(--accent) 20%, transparent)', drag: true, resize: true, minLength: Math.min(0.1, length) });
        setStart('0'); setEnd(String(Math.min(10, length))); setRegionInvalid(false);
        if (score) await wave.play();
      } catch { if (!disposed) { loadedScore.current = null; publishScorePlayback(null); setFailed(true); setReady(false); } }
    });
    return () => { disposed = true; };
  }, [wave, content.data, asset.data, selection]);

  useEffect(() => {
    wave?.setOptions(waveColors());
  }, [wave, theme]);

  async function play(regionOnly = false) {
    if (!wave || !ready) return;
    bounded.current = regionOnly;
    const region = regions.current?.getRegions()[0];
    if (regionOnly && region) wave.setTime(region.start);
    try { await wave.play(); } catch { bounded.current = false; setFailed(true); }
  }
  function applyRegion() {
    const from = Number(start), to = Number(end);
    if (!start.trim() || !end.trim() || !Number.isFinite(from) || !Number.isFinite(to) || from < 0 || from >= to || to > duration) { setRegionInvalid(true); return; }
    regions.current?.getRegions()[0]?.setOptions({ start: from, end: to });
    bounded.current = false; setRegionInvalid(false);
  }
  function reread() {
    if (!wave || selection?.kind === 'score') { setInitializationFailed(false); setInitializationAttempt(attempt => attempt + 1); }
    setFailed(false);
    if (isAsset) { void content.refetch(); void asset.refetch(); }
  }

  return <footer id="persistent-player" className="continuous-player" aria-label={t.player}>
    <audio ref={media} hidden preload="metadata" />
    <div className="player-title"><strong>{compare ? `${compare.pair.side.toUpperCase()} · ${version?.name ?? t.chooseVersion}` : selection && selection.kind !== 'compare' ? selection.label : t.empty}</strong><small>{selection?.kind === 'score' ? `${t.scoreTone} · r${selection.revision}` : selection ? asset.data?.kind === 'reference_audio' ? t.source : t.player : t.emptyHelp}</small>
      {compare ? <div className="feature-actions"><button type="button" onClick={() => selectPlayerCompare(projectId, { ...compare.pair, side: 'a' })}>{t.switchA}</button><button type="button" disabled={!compare.pair.b} onClick={() => selectPlayerCompare(projectId, { ...compare.pair, side: 'b' })}>{t.switchB}</button></div> : null}</div>
    <div className="player-main"><button type="button" disabled={!selection || !ready || failed} onClick={() => playing ? wave?.pause() : void play()} aria-label={playing ? t.pause : t.play}>{playing ? 'Ⅱ' : '▶'}</button>
      <div className="wave-container" style={{ visibility: ready ? 'visible' : 'hidden' }} ref={container} /><output aria-label={t.clock}>{clock(time)} / {clock(duration)}</output>
      <label className="seek-label"><span className="visually-hidden">{t.seek}</span><input type="range" aria-label={t.seek} min={0} max={duration || 0} step={0.1} value={time} disabled={!selection || !ready} onChange={event => { bounded.current = false; wave?.setTime(Number(event.target.value)); }} /></label>
    </div>
    {initializationFailed || selection && (failed || isAsset && (content.isError || asset.isError)) ? <div className="player-error" role="alert">{initializationFailed ? t.unavailable : t.failed}<button type="button" onClick={reread}>{t.retry}</button></div> : selection && !ready ? <small role="status">{t.loading}</small> : null}
    {selection ? <details className="player-regions"><summary>{t.region}</summary><div className="region-fields"><label>{t.start}<input type="number" step="0.1" min="0" max={duration} value={start} onChange={event => setStart(event.target.value)} /></label><label>{t.end}<input type="number" step="0.1" min="0" max={duration} value={end} onChange={event => setEnd(event.target.value)} /></label><button type="button" disabled={!ready} onClick={applyRegion}>{t.apply}</button><button type="button" disabled={!ready} onClick={() => void play(true)}>{t.playRegion}</button></div>{regionInvalid ? <p role="alert">{t.invalidRegion}</p> : null}</details> : null}
  </footer>;
}
