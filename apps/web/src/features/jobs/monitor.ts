import { useEffect, useState } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { jobEventsUrl, type JobEventRead, type JobRead } from '@llm-music/api-client';
import { isActiveJob, jobKeys, jobOptions } from './queries';

type Connection = 'connecting' | 'live' | 'recovering';
type Listener = (state: Connection) => void;
type Subscription = { listeners: Set<Listener>; state: Connection; dispose: () => void };
// Only connection handles live here. All Job snapshots remain in TanStack Query.
const connections = new WeakMap<QueryClient, Map<string, Subscription>>();
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));

function isEvent(value: unknown, projectId: string, jobId: string): value is JobEventRead {
  if (!record(value) || value.type !== 'job.updated' || !Number.isSafeInteger(value.sequence) || Number(value.sequence) < 1 || !record(value.job)) return false;
  const job = value.job;
  return job.id === jobId && job.project_id === projectId && typeof job.operation === 'string' && ['Transcribe', 'Generate', 'GenerateFromScore'].includes(job.operation)
    && typeof job.status === 'string' && ['queued', 'running', 'completed', 'failed', 'cancelled'].includes(job.status)
    && (job.phase === null || typeof job.phase === 'string')
    && (job.progress === undefined || job.progress === null || (typeof job.progress === 'number' && Number.isFinite(job.progress) && job.progress >= 0 && job.progress <= 1))
    && record(job.inputs) && record(job.provenance) && (job.error === null || record(job.error))
    && (job.result === null || (record(job.result) && Object.values(job.result).every(item => typeof item === 'string')))
    && typeof job.recovery_required === 'boolean' && (job.cancel_requested === undefined || typeof job.cancel_requested === 'boolean')
    && date(job.created_at) && date(job.updated_at);
}

function observe(cache: QueryClient, projectId: string, jobId: string, listener: Listener) {
  let registry = connections.get(cache);
  if (!registry) { registry = new Map(); connections.set(cache, registry); }
  const identity = JSON.stringify([projectId, jobId]);
  let entry = registry.get(identity);
  if (!entry) {
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let refreshing = false;
    let refreshAgain = false;
    entry = { listeners: new Set(), state: 'connecting', dispose: () => { disposed = true; clearTimeout(retry); clearTimeout(refreshTimer); socket?.close(); } };
    const subscription = entry;
    function update(state: Connection) {
      subscription.state = state;
      subscription.listeners.forEach(notify => notify(state));
    }
    async function refresh() {
      if (disposed) return;
      if (refreshing) { refreshAgain = true; return; }
      refreshing = true;
      // Socket payloads are hints, never a durable state source. Fresh GET defeats
      // stale/foreign/future event snapshots and restores the same target identity.
      try {
        await cache.invalidateQueries({ queryKey: jobKeys.detail(projectId, jobId), exact: true }, { cancelRefetch: false });
        void cache.invalidateQueries({ queryKey: jobKeys.list(projectId), exact: true }, { cancelRefetch: false });
      } finally {
        refreshing = false;
        if (refreshAgain) { refreshAgain = false; scheduleRefresh(); }
      }
    }
    function scheduleRefresh() {
      if (disposed || refreshTimer) return;
      refreshTimer = setTimeout(() => { refreshTimer = undefined; void refresh(); }, 250);
    }
    function connect() {
      if (disposed) return;
      let sequence = 0; // A new connection has a new live channel, not a replay cursor.
      update('connecting');
      const current = new WebSocket(jobEventsUrl(new URL('/api', location.origin).href, projectId, jobId));
      socket = current;
      current.onopen = () => { if (!disposed && socket === current) { update('live'); void refresh(); } };
      current.onmessage = event => {
        if (disposed || socket !== current) return;
        let value: unknown;
        try { value = JSON.parse(String(event.data)); } catch { return; }
        if (!isEvent(value, projectId, jobId) || value.sequence <= sequence) return;
        sequence = value.sequence;
        scheduleRefresh();
      };
      current.onerror = () => current.close();
      current.onclose = () => {
        if (disposed || socket !== current) return;
        update('recovering'); void refresh();
        retry = setTimeout(connect, 1_500);
      };
    }
    registry.set(identity, entry);
    connect();
  }
  entry.listeners.add(listener);
  listener(entry.state);
  const subscription = entry;
  return () => {
    subscription.listeners.delete(listener);
    if (subscription.listeners.size === 0) { subscription.dispose(); registry.delete(identity); }
  };
}

export function useJobMonitor(projectId: string, jobId: string, initialData?: JobRead) {
  const cache = useQueryClient();
  const job = useQuery({ ...jobOptions(projectId, jobId), initialData: initialData?.project_id === projectId && initialData.id === jobId ? initialData : undefined });
  const [connection, setConnection] = useState<Connection>('connecting');
  const active = Boolean(job.data && isActiveJob(job.data));
  useEffect(() => active ? observe(cache, projectId, jobId, setConnection) : undefined, [cache, projectId, jobId, active]);
  return { ...job, connection: active ? connection : 'settled' as const };
}
