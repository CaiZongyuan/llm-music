import { queryOptions } from '@tanstack/react-query';
import { api, dataOf } from '../../lib/api';

export const projectKeys = {
  list: ['projects'] as const,
  detail: (projectId: string) => ['projects', projectId] as const,
};
export function projectsOptions() {
  return queryOptions({ queryKey: projectKeys.list, queryFn: async ({ signal }) => dataOf(await api.GET('/projects', { signal })) });
}
export function projectOptions(projectId: string) {
  return queryOptions({ queryKey: projectKeys.detail(projectId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}', { params: { path: { project_id: projectId } }, signal })) });
}
