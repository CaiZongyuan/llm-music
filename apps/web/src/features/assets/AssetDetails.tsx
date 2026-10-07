import { useMutation, useQuery } from '@tanstack/react-query';
import { useMessages } from '../preferences/Preferences';
import { ErrorNotice, Loading } from '../../components/States';
import { assetMessages } from './messages';
import { assetOptions, readAssetContent } from './queries';

export function AssetDetails({ projectId, assetId }: { projectId: string; assetId: string }) {
  const t = useMessages(assetMessages);
  const asset = useQuery(assetOptions(projectId, assetId));
  const download = useMutation({
    mutationFn: () => readAssetContent(projectId, assetId),
    onSuccess: bytes => {
      if (!asset.data) return;
      const url = URL.createObjectURL(new Blob([bytes], { type: asset.data.media_type }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = asset.data.original_name;
      document.body.append(anchor); anchor.click(); anchor.remove();
      // Keep the file alive while the browser accepts the native download.
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    },
  });
  if (asset.isPending) return <Loading />;
  if (asset.isError) return <ErrorNotice error={asset.error} onRetry={() => void asset.refetch()} />;
  const value = asset.data;
  return <section className="surface soft asset-detail" aria-label={t.detail}><span className="eyebrow">{t.saved}</span><h2>{value.original_name}</h2>
    <dl className="facts"><dt>{t.kind}</dt><dd>{t[value.kind]}</dd><dt>{t.format}</dt><dd>{value.format.toUpperCase()} · {value.size_bytes.toLocaleString()} {t.bytes}</dd>
      {value.duration_seconds !== null && value.duration_seconds !== undefined ? <><dt>{t.duration}</dt><dd>{value.duration_seconds} {t.seconds}</dd></> : null}
      {value.channels ? <><dt>{t.channels}</dt><dd>{value.channels}</dd></> : null}{value.sample_rate ? <><dt>{t.rate}</dt><dd>{value.sample_rate.toLocaleString()} Hz</dd></> : null}
    </dl><label className="identity-label">{t.identity}<code>{value.id}</code></label><label className="identity-label">{t.hash}<code>{value.sha256}</code></label>
    <button type="button" onClick={() => download.mutate()} disabled={download.isPending}>{download.isPending ? t.downloading : t.download} ↓</button>
    {download.isError ? <ErrorNotice error={download.error} onRetry={() => download.mutate()} /> : null}
  </section>;
}
