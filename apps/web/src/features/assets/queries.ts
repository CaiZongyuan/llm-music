import { queryOptions } from '@tanstack/react-query';
import { api, dataOf } from '../../lib/api';

export const assetKeys = {
  list: (projectId: string) => ['projects', projectId, 'assets'] as const,
  detail: (projectId: string, assetId: string) => ['projects', projectId, 'assets', assetId] as const,
};
export function assetsOptions(projectId: string) {
  return queryOptions({ queryKey: assetKeys.list(projectId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/assets', { params: { path: { project_id: projectId } }, signal })) });
}
export function assetOptions(projectId: string, assetId: string) {
  return queryOptions({ queryKey: assetKeys.detail(projectId, assetId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/assets/{asset_id}', { params: { path: { project_id: projectId, asset_id: assetId } }, signal })) });
}
export async function readAssetContent(projectId: string, assetId: string) {
  return dataOf(await api.GET('/projects/{project_id}/assets/{asset_id}/content', { params: { path: { project_id: projectId, asset_id: assetId } }, parseAs: 'arrayBuffer' }));
}
