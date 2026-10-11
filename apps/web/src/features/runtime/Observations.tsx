import { useEffect, useState, type ReactNode } from 'react';
import type { components } from '@llm-music/api-client';
import { useMessages } from '../preferences/Preferences';
import { runtimeMessages } from './runtime-messages';
import { ApiFailure } from '../../lib/api';

type Source = components['schemas']['DiagnosticSource'];
type Reason = components['schemas']['DiagnosticReason'];
export function RuntimeReadFailure({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useMessages(runtimeMessages);
  const code = error instanceof ApiFailure ? error.detail?.code : undefined;
  return <section className="error-box" role="alert"><strong>{t.readFailed}</strong><p>{t.retryHelp}</p>
    {code ? <small>{t.problem}: <code>{code}</code></small> : null}<button type="button" onClick={onRetry}>{t.readAgain}</button></section>;
}
export function useObservationClock() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  // A response can be newer than the last timer tick. Use render time while the
  // timer only requests updates for observations that expire without new data.
  return Math.max(now, Date.now());
}
export function freshness(source: Source, now: number): Source['freshness'] {
  if (source.freshness !== 'fresh') return source.freshness;
  const observed = source.observed_at ? Date.parse(source.observed_at) : NaN;
  if (!Number.isFinite(observed) || observed > now) return 'unavailable';
  if (source.max_age_seconds === null) return 'fresh';
  return now - observed >= source.max_age_seconds * 1000 ? 'stale' : 'fresh';
}
export function Observation({ source, now }: { source: Source; now: number }) {
  const t = useMessages(runtimeMessages);
  return <div className="runtime-observation"><small>{t[freshness(source, now)]}</small><details><summary>{t.observation}</summary>
    <small>{source.observed_at ?? t.missingTime}<br />{t.source}: <code>{source.source}</code></small></details></div>;
}
export function ObservedValue({ reading, now, children }: { reading: { value: unknown; availability: string; observation: Source }; now: number; children: ReactNode }) {
  const t = useMessages(runtimeMessages);
  const state = freshness(reading.observation, now);
  const current = state === 'fresh' && reading.availability === 'available' && reading.value !== null;
  return <><strong>{current ? children : state === 'stale' ? t.stale : t.unknown}</strong>
    {!current && reading.value !== null ? <small>{t.history}: {children}</small> : null}
    <Observation source={reading.observation} now={now} /></>;
}
export function Reasons({ reasons }: { reasons: Reason[] }) {
  const t = useMessages(runtimeMessages);
  if (!reasons.length) return null;
  return <ul className="runtime-reasons">{reasons.map(reason => {
    const code = reason.code;
    const message = code === 'model_missing' ? t.modelMissing : code === 'model_downloading' ? t.modelDownloading
      : code.startsWith('model_') && (code.includes('invalid') || code.includes('mismatch') || code === 'model_fingerprint_changed') ? t.modelInvalid
      : code.includes('stale') ? t.staleHelp : code.startsWith('gpu_') ? t.gpuHelp
      : code.includes('unavailable') ? t.unavailableHelp : t.prerequisitesHelp;
    return <li key={code}>{message}<small>{t.problem}: <code>{code}</code></small></li>;
  })}</ul>;
}
