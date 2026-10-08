import { queryOptions } from '@tanstack/react-query';
import { api, dataOf } from '../../lib/api';

export const versionKeys = {
  list: (projectId: string) => ['projects', projectId, 'versions'] as const,
  detail: (projectId: string, versionId: string) => ['projects', projectId, 'versions', versionId] as const,
};
export function versionsOptions(projectId: string) {
  return queryOptions({ queryKey: versionKeys.list(projectId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/versions', { params: { path: { project_id: projectId } }, signal })) });
}
export function versionOptions(projectId: string, versionId: string) {
  return queryOptions({ queryKey: versionKeys.detail(projectId, versionId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/versions/{version_id}', { params: { path: { project_id: projectId, version_id: versionId } }, signal })) });
}
