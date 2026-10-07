import { queryOptions } from '@tanstack/react-query';
import { api, dataOf } from '../../lib/api';

export const candidateKeys = {
  list: (projectId: string) => ['projects', projectId, 'candidates'] as const,
  detail: (projectId: string, candidateId: string) => ['projects', projectId, 'candidates', candidateId] as const,
};
export function candidatesOptions(projectId: string) {
  return queryOptions({ queryKey: candidateKeys.list(projectId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/candidates', { params: { path: { project_id: projectId } }, signal })) });
}
export function candidateOptions(projectId: string, candidateId: string) {
  return queryOptions({ queryKey: candidateKeys.detail(projectId, candidateId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/candidates/{candidate_id}', { params: { path: { project_id: projectId, candidate_id: candidateId } }, signal })) });
}
