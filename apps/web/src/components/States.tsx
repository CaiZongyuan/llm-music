import { ApiFailure } from '../lib/api';
import { useMessages } from '../features/preferences/Preferences';
import { shellMessages } from './messages';

export function Loading() {
  const t = useMessages(shellMessages);
  return <div role="status" className="loading"><span className="pulse" />{t.busy}</div>;
}
export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useMessages(shellMessages);
  const apiError = error instanceof ApiFailure ? error : undefined;
  const code = apiError?.detail?.code;
  const message = code?.includes('unconfirmed') || code === 'project_persistence_failed' ? t.unconfirmed
    : apiError?.status === 404 ? t.notFound
    : apiError?.status === 422 || apiError?.status === 413 ? t.invalid
    : apiError?.status === 409 || apiError?.status === 503 ? t.unavailable : t.network;
  return <section className="error-box" role="alert"><strong>{t.failed}</strong><p>{message}</p>
    {code ? <small>{t.code}: <code>{code}</code>{apiError.detail?.resource_id ? <> · {t.identity}: <code>{apiError.detail.resource_id}</code></> : null}</small> : null}
    {onRetry ? <button type="button" onClick={onRetry}>{t.retry}</button> : null}
  </section>;
}
