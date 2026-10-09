import { useSyncExternalStore } from 'react';
import type { GenerateFromScoreCreate } from '@llm-music/api-client';

export type ScoreSubmission = Readonly<{ id: string; body: Readonly<GenerateFromScoreCreate>; state: 'submitting' | 'unconfirmed' | 'acknowledged'; jobId?: string }>;
const submissions = new Map<string, ScoreSubmission | null>();
const listeners = new Set<() => void>();
const storageKey = (projectId: string) => `llm-music:score-submission:1:${projectId}`;

// JobRead.inputs is an open application record; narrow only the operation this
// UI knows. Never send a restored storage record automatically.
export function scoreGenerationInputs(value: Record<string, unknown>): GenerateFromScoreCreate | null {
  if (typeof value.abc !== 'string' || typeof value.source_score_id !== 'string' || typeof value.style !== 'string' || typeof value.lyrics !== 'string'
      || typeof value.seed !== 'number' || !Number.isSafeInteger(value.seed) || value.seed < 0
      || typeof value.max_seconds !== 'number' || !Number.isSafeInteger(value.max_seconds) || value.max_seconds < 0 || value.max_seconds > 360
      || !(value.parent_version_id === null || value.parent_version_id === undefined || typeof value.parent_version_id === 'string')) return null;
  return { abc: value.abc, source_score_id: value.source_score_id, parent_version_id: value.parent_version_id,
    style: value.style, lyrics: value.lyrics, seed: value.seed, max_seconds: value.max_seconds };
}

export function scoreSubmission(projectId: string): ScoreSubmission | null {
  if (!submissions.has(projectId)) {
    let restored: ScoreSubmission | null = null;
    try {
      const raw: unknown = JSON.parse(sessionStorage.getItem(storageKey(projectId)) ?? 'null');
      if (raw && typeof raw === 'object' && 'id' in raw && typeof raw.id === 'string' && 'body' in raw && raw.body && typeof raw.body === 'object') {
        const body = scoreGenerationInputs(raw.body as Record<string, unknown>);
        if (body) {
          const jobId = 'jobId' in raw && typeof raw.jobId === 'string' ? raw.jobId : undefined;
          restored = Object.freeze({ id: raw.id, body: Object.freeze(body), state: jobId ? 'acknowledged' : 'unconfirmed', ...(jobId ? { jobId } : {}) });
        }
      }
    } catch { /* Storage is optional; current-session state remains available. */ }
    submissions.set(projectId, restored);
  }
  return submissions.get(projectId) ?? null;
}

export function retainScoreSubmission(projectId: string, value: ScoreSubmission | null) {
  const snapshot = value ? Object.freeze({ ...value, body: Object.freeze({ ...value.body }) }) : null;
  submissions.set(projectId, snapshot);
  try { if (snapshot) sessionStorage.setItem(storageKey(projectId), JSON.stringify(snapshot)); else sessionStorage.removeItem(storageKey(projectId)); } catch { /* Keep the in-memory captured intent. */ }
  listeners.forEach(listener => listener());
}

export function useScoreSubmission(projectId: string) {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, () => scoreSubmission(projectId));
}
