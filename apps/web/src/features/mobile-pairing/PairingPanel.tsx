import { useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, dataOf } from '../../lib/api';
import { useMessages } from '../preferences/Preferences';
import { pairingMessages } from './messages';
import './pairing.css';

export function PairingPanel() {
  const t = useMessages(pairingMessages), heading = useId();
  const connection = useQuery({
    queryKey: ['mobile', 'connection'],
    queryFn: async ({ signal }) => dataOf(await api.GET('/connection', { signal })),
  });
  return <section className="mobile-pairing" aria-labelledby={heading}>
    <div className="mobile-pairing-label">{t.label}</div><h2 id={heading}>{t.title}</h2><p>{t.intro}</p>
    {connection.isPending ? <p role="status">{t.loading}</p> : null}
    {connection.isError ? <p className="mobile-pairing-error" role="alert">{t.readFailed}</p> : null}
    {connection.data ? <section><h3>{t.address}</h3>
      {connection.data.lan_address ? <><code className="mobile-pairing-address" data-testid="pairing-lan-address">{connection.data.lan_address}</code><p>{t.connect}</p></>
        : <p>{t.missingLan}</p>}
    </section> : null}
    <div className="mobile-pairing-actions"><button type="button" data-testid="pairing-refresh" disabled={connection.isFetching}
      onClick={() => { void connection.refetch(); }}>{t.refresh}</button></div>
  </section>;
}
