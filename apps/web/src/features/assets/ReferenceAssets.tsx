import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, dataOf, type AssetRead } from '../../lib/api';
import { ErrorNotice, Loading } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { assetMessages } from './messages';
import { assetKeys, assetsOptions } from './queries';
import { AssetDetails } from './AssetDetails';

export function ReferenceAssets({ projectId }: { projectId: string }) {
  const t = useMessages(assetMessages);
  const assets = useQuery(assetsOptions(projectId));
  const cache = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const upload = useMutation({
    mutationFn: async (value: File) => dataOf(await api.POST('/projects/{project_id}/assets', {
      params: { path: { project_id: projectId } }, body: { file: value },
      bodySerializer: body => { const form = new FormData(); form.append('file', body.file); return form; },
    })),
    onSuccess: async asset => {
      await cache.cancelQueries({ queryKey: assetKeys.list(projectId), exact: true });
      cache.setQueryData<AssetRead[]>(assetKeys.list(projectId), previous => [...(previous ?? []).filter(item => item.id !== asset.id), asset]);
      cache.setQueryData(assetKeys.detail(projectId, asset.id), asset);
      void cache.invalidateQueries({ queryKey: assetKeys.list(projectId), exact: true });
      setSelectedId(asset.id);
    },
  });
  const chosenId = selectedId ?? assets.data?.[0]?.id;
  function submit(event: FormEvent) { event.preventDefault(); if (file) upload.mutate(file); }
  return <><div className="workspace-grid"><section className="surface"><h2>{t.title}</h2><p className="hint">{t.intro}</p><form onSubmit={submit}>
    <label className="file-picker">{t.file}<input type="file" accept=".wav,audio/wav" onChange={event => { setFile(event.target.files?.[0] ?? null); upload.reset(); }} /></label>
    {file ? <p className="selected-file">{t.selected}: <strong>{file.name}</strong> · {file.size.toLocaleString()} {t.bytes}</p> : null}
    <p className="field-help">{t.limits}</p><button className="primary" type="submit" disabled={!file || upload.isPending}>{upload.isPending ? t.uploading : t.upload} →</button>
    {upload.isError ? <ErrorNotice error={upload.error} onRetry={() => void assets.refetch()} /> : null}
  </form></section><section className="surface"><div className="section-heading"><h2>{t.list}</h2><button type="button" onClick={() => void assets.refetch()}>{t.refresh}</button></div>
    {assets.isPending ? <Loading /> : assets.isError ? <ErrorNotice error={assets.error} onRetry={() => void assets.refetch()} /> : assets.data.length === 0
      ? <div className="empty"><span className="empty-mark" aria-hidden="true">♪</span><h3>{t.empty}</h3><p>{t.emptyBody}</p></div>
      : <ul className="asset-list">{assets.data.map(asset => <li key={asset.id}><button type="button" className={chosenId === asset.id ? 'selected' : ''} aria-pressed={chosenId === asset.id} onClick={() => setSelectedId(asset.id)}><span aria-hidden="true">♪</span><div><strong>{asset.original_name}</strong><small>{t[asset.kind]} · {asset.format.toUpperCase()}</small></div></button></li>)}</ul>}
  </section></div>{chosenId ? <AssetDetails key={`${projectId}/${chosenId}`} projectId={projectId} assetId={chosenId} /> : null}</>;
}
