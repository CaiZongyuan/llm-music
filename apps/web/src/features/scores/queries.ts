import { queryOptions } from '@tanstack/react-query';
import { api, dataOf } from '../../lib/api';
import { readAssetContent } from '../assets/queries';

export const scoreKeys = {
  list: (projectId: string) => ['projects', projectId, 'scores'] as const,
  detail: (projectId: string, scoreId: string) => ['projects', projectId, 'scores', scoreId] as const,
  abc: (projectId: string, assetId: string) => ['projects', projectId, 'assets', assetId, 'abc'] as const,
};
export function scoresOptions(projectId: string) {
  return queryOptions({ queryKey: scoreKeys.list(projectId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/scores', { params: { path: { project_id: projectId } }, signal })) });
}
export function scoreOptions(projectId: string, scoreId: string) {
  return queryOptions({ queryKey: scoreKeys.detail(projectId, scoreId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { project_id: projectId, score_id: scoreId } }, signal })) });
}
export function abcOptions(projectId: string, assetId: string) {
  return queryOptions({ queryKey: scoreKeys.abc(projectId, assetId), queryFn: async () => new TextDecoder('utf-8', { fatal: true }).decode(await readAssetContent(projectId, assetId)) });
}
