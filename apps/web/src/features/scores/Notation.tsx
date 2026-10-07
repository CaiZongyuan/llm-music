import { useEffect, useRef, useState } from 'react';
import { useMessages } from '../preferences/Preferences';
import { scoreMessages } from './messages';

export function Notation({ abc }: { abc: string }) {
  const t = useMessages(scoreMessages);
  const target = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  useEffect(() => {
    let active = true;
    const element = target.current;
    setState('loading');
    void import('abcjs').then(module => {
      if (!active || !element) return;
      const tunes = module.default.renderAbc(element, abc, { responsive: 'resize', add_classes: true });
      if (!tunes.length || !element.querySelector('svg')) throw new Error('No readable notation');
      setState('ready');
    }).catch(() => { if (active) setState('failed'); });
    return () => { active = false; element?.replaceChildren(); };
  }, [abc, attempt]);
  return <section aria-label={t.notation} className="score-notation">
    {state === 'loading' ? <p role="status">{t.loadingNotation}</p> : null}
    {state === 'failed' ? <div className="error-box" role="alert"><p>{t.renderFailed}</p><button type="button" onClick={() => setAttempt(value => value + 1)}>{t.retryRender}</button></div> : null}
    <div ref={target} role="img" aria-label={t.notation} hidden={state !== 'ready'} />
  </section>;
}
