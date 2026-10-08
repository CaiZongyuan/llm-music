import { useSyncExternalStore } from 'react';
import type { CoverCreate, components } from '@llm-music/api-client';
import { scoreGenerationInputs } from '../scores/submissions';

export type CoverSubmission = Readonly<{ id: string; body: Readonly<CoverCreate>; effectiveABC: string; state: 'submitting' | 'unconfirmed' | 'acknowledged'; jobId?: string }>;
type VersionReferenceCreate = components['schemas']['VersionReferenceCreate'];
export type ReferenceIntent = Readonly<VersionReferenceCreate & Required<Pick<VersionReferenceCreate, 'save_id'>>>;
const submissions = new Map<string, CoverSubmission | null>();
const references = new Map<string, ReferenceIntent | null>();
const listeners = new Set<() => void>();
const key = (kind: string, projectId: string) => `llm-music:cover-${kind}:1:${projectId}`;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);

export function coverInputs(value: Record<string, unknown>): CoverCreate | null {
  const base = scoreGenerationInputs(value);
  if (!base || value.mode !== 'melody' || !uuid(value.reference_asset_id) || typeof value.effective_abc_sha256 !== 'string'
    || !/^[\da-f]{64}$/.test(value.effective_abc_sha256) || value.mode_transform_version !== '1.0.0') return null;
  return { ...base, mode: 'melody', reference_asset_id: value.reference_asset_id, effective_abc_sha256: value.effective_abc_sha256, mode_transform_version: '1.0.0' };
}
function stored(kind: string, projectId: string): unknown {
  try { return JSON.parse(sessionStorage.getItem(key(kind, projectId)) ?? 'null'); } catch { return null; }
}
function persist(kind: string, projectId: string, value: unknown) {
  try { if (value) sessionStorage.setItem(key(kind, projectId), JSON.stringify(value)); else sessionStorage.removeItem(key(kind, projectId)); } catch { /* The current session remains usable. */ }
  listeners.forEach(listener => listener());
}
export function coverSubmission(projectId: string): CoverSubmission | null {
  if (!submissions.has(projectId)) {
    const raw = stored('submission', projectId); let value: CoverSubmission | null = null;
    if (raw && typeof raw === 'object' && 'id' in raw && uuid(raw.id) && 'body' in raw && raw.body && typeof raw.body === 'object') {
      const body = coverInputs(raw.body as Record<string, unknown>), jobId = 'jobId' in raw && uuid(raw.jobId) ? raw.jobId : undefined;
      if (body && 'effectiveABC' in raw && typeof raw.effectiveABC === 'string') value = Object.freeze({ id: raw.id, body: Object.freeze(body), effectiveABC: raw.effectiveABC, state: jobId ? 'acknowledged' : 'unconfirmed', ...(jobId ? { jobId } : {}) });
    }
    submissions.set(projectId, value);
  }
  return submissions.get(projectId) ?? null;
}
export function retainCoverSubmission(projectId: string, value: CoverSubmission | null) {
  const captured = value ? Object.freeze({ ...value, body: Object.freeze({ ...value.body }) }) : null;
  submissions.set(projectId, captured); persist('submission', projectId, captured);
}
export function useCoverSubmission(projectId: string) {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => coverSubmission(projectId));
}
export function referenceIntent(projectId: string): ReferenceIntent | null {
  if (!references.has(projectId)) {
    const raw = stored('reference', projectId);
    references.set(projectId, raw && typeof raw === 'object' && 'source_version_id' in raw && uuid(raw.source_version_id) && 'save_id' in raw && uuid(raw.save_id)
      ? Object.freeze({ source_version_id: raw.source_version_id, save_id: raw.save_id }) : null);
  }
  return references.get(projectId) ?? null;
}
export function retainReferenceIntent(projectId: string, value: ReferenceIntent | null) {
  const captured = value ? Object.freeze({ ...value }) : null; references.set(projectId, captured); persist('reference', projectId, captured);
}
export function useReferenceIntent(projectId: string) {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => referenceIntent(projectId));
}
