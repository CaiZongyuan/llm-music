import { queryOptions, useQuery } from '@tanstack/react-query';
import type { components } from '@llm-music/api-client';
import { api, dataOf } from '../../lib/api';
import { ErrorNotice, Loading } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { capabilityMessages } from './messages';

type CapabilitiesRead = components['schemas']['CapabilitiesRead'];
type Operation = components['schemas']['CapabilityRead']['operation'];
function expiresAt(observation: components['schemas']['DiagnosticSource']) {
  return observation.observed_at ? Date.parse(observation.observed_at) + observation.max_age_seconds * 1000 : NaN;
}
export function operationReady(data: CapabilitiesRead | undefined, operation: Operation): boolean {
  const capability = data?.capabilities.find(value => value.operation === operation);
  return Boolean(capability?.ready && capability.observation.freshness === 'fresh' && expiresAt(capability.observation) > Date.now());
}
export function capabilitiesOptions() {
  return queryOptions({
    queryKey: ['runtime', 'capabilities'] as const,
    queryFn: async ({ signal }) => dataOf(await api.GET('/runtime/capabilities', { signal })),
    // Recheck at the authoritative freshness deadline; unavailable observations
    // wait for an explicit user recheck rather than claiming a restored Runtime.
    refetchInterval: query => {
      const deadlines = query.state.data?.capabilities.filter(value => value.ready && value.observation.freshness === 'fresh').map(value => expiresAt(value.observation)).filter(Number.isFinite);
      return deadlines?.length ? Math.max(1000, Math.min(...deadlines) - Date.now()) : false;
    },
  });
}
export function CapabilityReadiness({ operation }: { operation: Operation }) {
  const t = useMessages(capabilityMessages);
  const query = useQuery(capabilitiesOptions());
  const capability = query.data?.capabilities.find(value => value.operation === operation);
  const codes = capability?.reasons.map(reason => reason.code) ?? [];
  const ready = !query.isError && operationReady(query.data, operation);
  const message = codes.some(code => code.includes('unavailable')) ? t.unavailable
    : codes.some(code => code.includes('stale')) || capability?.observation.freshness === 'stale' ? t.stale
    : codes.length ? t.missing : t.unknown;
  return <section aria-label={t[operation]}><div className="section-heading"><h3>{ready ? t.ready : t.notReady}</h3><button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>{t.recheck}</button></div>
    {query.isPending ? <Loading /> : query.isError ? <ErrorNotice error={query.error} onRetry={() => void query.refetch()} /> : !ready ? <p>{message}</p> : null}
    {query.data?.mode === 'fake' ? <small>{t.fake}</small> : null}{codes.length ? <small>{t.code}: {codes.join(', ')}</small> : null}
  </section>;
}
