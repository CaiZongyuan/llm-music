import { useEffect, useId, useMemo, useState, useSyncExternalStore } from 'react';
import { api } from '../../lib/api';
import { useMessages } from '../preferences/Preferences';
import { createPairingAdmin } from './controller';
import { pairingMessages } from './messages';
import './pairing.css';

export function PairingPanel() {
  const admin = useMemo(() => createPairingAdmin(api), []);
  const state = useSyncExternalStore(admin.subscribe, admin.getSnapshot, admin.getSnapshot);
  const [now, setNow] = useState(() => Date.now());
  const t = useMessages(pairingMessages), heading = useId();
  useEffect(() => {
    void admin.refresh().catch(() => {});
    const refresh = setInterval(() => { void admin.refresh().catch(() => {}); }, 5000);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(refresh); clearInterval(clock); admin.suspend(); };
  }, [admin]);
  const challenge = state.owner?.challenge;
  const expired = challenge?.status === 'active' && challenge.expires_at * 1000 <= now;
  const active = challenge?.status === 'active' && !expired;
  const code = active && state.code?.id === challenge?.id ? state.code : null;
  const remaining = Math.min(120, Math.max(0, Math.ceil(((challenge?.expires_at ?? 0) * 1000 - now) / 1000)));
  const blocked = state.busy || state.loading;
  const canOpen = !!state.owner?.lan_address && !state.ownerError && !blocked;
  const status = !state.owner ? state.ownerError ? t.readFailed : t.loading
    : expired ? t.expired : challenge?.status === 'consumed' ? t.consumed : challenge?.status === 'locked' ? t.locked : active ? t.active : t.inactive;
  const error = state.error === 'owner_csrf_required' ? t.csrfExpired : ['owner_local_only', 'owner_origin_forbidden'].includes(state.error ?? state.ownerError ?? '') ? t.localOnly : t.operationFailed;
  return <section className="mobile-pairing" aria-labelledby={heading}>
    <div className="mobile-pairing-label">{t.label}</div><h2 id={heading}>{t.title}</h2><p>{t.intro}</p>
    {state.loading ? <p role="status">{t.loading}</p> : null}
    {state.ownerError || state.deviceError ? <p className="mobile-pairing-error" role="alert">{state.ownerError === 'owner_origin_forbidden' ? t.localOnly : t.readFailed}</p> : null}
    {state.error ? <p className="mobile-pairing-error" role="alert">{error}</p> : null}
    {state.unknownOpen ? <p className="mobile-pairing-warning" role="status">{t.openingUnknown}</p> : null}
    <div className="mobile-pairing-columns">
      <section><h3>{t.connection}</h3><p data-testid="pairing-window-status" role="status">{status}</p>
        {state.owner?.lan_address ? <><h3>{t.address}</h3><code className="mobile-pairing-address" data-testid="pairing-lan-address">{state.owner.lan_address}</code></> : state.owner ? <p>{t.missingLan}</p> : null}
        <div className="mobile-pairing-actions">
          <button type="button" className="mobile-pairing-primary" data-testid="pairing-open" disabled={!canOpen}
            onClick={() => { void admin.open().catch(() => {}); }}>{state.busy ? t.busy : challenge ? t.renew : t.open}</button>
          <button type="button" data-testid="pairing-close" disabled={!active || blocked || !!state.ownerError}
            onClick={() => { void admin.close().catch(() => {}); }}>{t.close}</button>
        </div>
        {code && !state.loading ? <><h3>{t.code}</h3><output className="mobile-pairing-code" data-testid="pairing-code">{code.code}</output>
          <p data-testid="pairing-expiry">{t.lifetime.replace('{seconds}', String(remaining))}</p><p>{t.oneTime}</p></>
          : active && !state.loading ? <p data-testid="pairing-code-unavailable">{t.codeUnavailable}</p> : null}
        <p>{t.closeMeaning}</p>
      </section>
      <section><h3>{t.devices}</h3>
        {state.devices?.length === 0 ? <p data-testid="pairing-devices-empty">{t.devicesEmpty}</p> : null}
        {state.devices?.map(device => <article className="mobile-pairing-device" key={device.id} data-testid={`paired-device-${device.id}`}>
          <strong>{device.name}</strong><p className={device.revoked_at === null ? 'mobile-pairing-authorized' : 'mobile-pairing-error'}>{device.revoked_at === null ? t.authorized : t.revoked}</p>
          <p>{device.revoked_at === null ? t.deviceAccess : t.revokedHelp}</p>
          <button type="button" disabled={device.revoked_at !== null || blocked || !!state.ownerError} data-testid={`revoke-device-${device.id}`}
            onClick={() => { void admin.revoke(device.id).catch(() => {}); }}>{t.revoke}</button>
        </article>)}
      </section>
    </div>
    <div className="mobile-pairing-actions"><button type="button" data-testid="pairing-refresh" disabled={blocked}
      onClick={() => { void admin.refresh().catch(() => {}); }}>{t.refresh}</button></div>
  </section>;
}
