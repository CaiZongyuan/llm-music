import { useMutation, useQuery } from '@tanstack/react-query';
import { ErrorNotice, Loading } from '../../components/States';
import { assetOptions, readAssetContent } from '../assets/queries';
import { useMessages } from '../preferences/Preferences';
import { scoreMessages } from './messages';

export function ScoreDownload({ projectId, assetId, kind }: { projectId: string; assetId: string; kind: 'abc' | 'midi' }) {
  const t = useMessages(scoreMessages);
  const asset = useQuery(assetOptions(projectId, assetId));
  const download = useMutation({
    mutationFn: () => readAssetContent(projectId, assetId),
    onSuccess: bytes => {
      if (!asset.data) return;
      const url = URL.createObjectURL(new Blob([bytes], { type: asset.data.media_type }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = asset.data.original_name;
      document.body.append(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
  });
  if (asset.isPending) return <Loading />;
  if (asset.isError) return <ErrorNotice error={asset.error} onRetry={() => void asset.refetch()} />;
  return <div className="score-download"><button type="button" className={kind === 'midi' ? 'primary' : ''} disabled={download.isPending} onClick={() => download.mutate()}>{download.isPending ? t.downloading : kind === 'midi' ? t.midi : t.downloadAbc} ↓</button>
    <small>{asset.data.original_name} · {asset.data.size_bytes.toLocaleString()} B</small>
    <details className="record-details"><summary>{t.fileId}</summary><code>{assetId}</code><code>SHA256: {asset.data.sha256}</code></details>
    {download.isError ? <div className="error-box" role="alert"><p>{t.downloadFailed}</p><button type="button" onClick={() => download.mutate()}>{t.retryDownload}</button></div> : null}
  </div>;
}
