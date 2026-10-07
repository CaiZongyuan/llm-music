import { queryOptions } from '@tanstack/react-query';
import { api, dataOf } from '../../lib/api';

export function healthOptions() {
  return queryOptions({ queryKey: ['runtime', 'health'] as const,
    queryFn: async ({ signal }) => dataOf(await api.GET('/health', { signal })) });
}
export function diagnosticsOptions() {
  return queryOptions({ queryKey: ['runtime', 'diagnostics'] as const,
    queryFn: async ({ signal }) => dataOf(await api.GET('/runtime/diagnostics', { signal })) });
}
export function modelsOptions() {
  return queryOptions({ queryKey: ['runtime', 'models'] as const,
    queryFn: async ({ signal }) => dataOf(await api.GET('/runtime/models', { signal })) });
}
export function settingsMetadataOptions() {
  return queryOptions({ queryKey: ['settings', 'metadata'] as const,
    queryFn: async ({ signal }) => dataOf(await api.GET('/settings/metadata', { signal })) });
}
