import { queryOptions, useQuery } from '@tanstack/react-query';
import { api, dataOf } from '../../lib/api';
import { ErrorNotice, Loading } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { ParentVersionLink } from '../versions/ParentVersionLink';
import { coverMessages } from './messages';

export function referenceOriginOptions(projectId: string, assetId: string) {
  return queryOptions({ queryKey: ['projects', projectId, 'assets', assetId, 'reference-origin'] as const,
    queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/assets/{asset_id}/reference-origin', { params: { path: { project_id: projectId, asset_id: assetId } }, signal })) });
}
export function ReferenceOrigin({ projectId, assetId }: { projectId: string; assetId: string }) {
  const t = useMessages(coverMessages), query = useQuery(referenceOriginOptions(projectId, assetId));
  if (query.isPending) return <Loading />;
  if (query.isError) return <ErrorNotice error={query.error} onRetry={() => void query.refetch()} />;
  const origin = query.data;
  return origin ? <div className="cover-reference-origin" data-source-version-id={origin.source_version_id}><p>{t.sourceVersion}: <ParentVersionLink projectId={projectId} versionId={origin.source_version_id} /></p><p>{t.interval}: {origin.start_frame / origin.sample_rate}–{(origin.start_frame + origin.frame_count) / origin.sample_rate} s</p><details className="record-details"><summary>{t.sourceAudio}</summary><pre>{JSON.stringify(origin, null, 2)}</pre></details></div> : <p className="hint">{t.uploaded}</p>;
}
