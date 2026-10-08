import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { components } from '@llm-music/api-client';
import { Loading } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { settingsMetadataOptions } from './queries';
import { settingsMessages } from './settings-messages';
import { RuntimeReadFailure } from './Observations';
import './runtime.css';

type Json = components['schemas']['JsonValue'];
function record(value: Json | undefined): Record<string, Json> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : undefined;
}

export function Settings() {
  const t = useMessages(settingsMessages);
  const query = useQuery(settingsMetadataOptions());
  const properties = record(query.data?.settings_schema.properties);
  const labels: Record<string, string> = t;
  return <div className="runtime-page"><header className="page-heading"><h1>{t.title}</h1><p>{t.intro}</p></header>
    <div className="workspace-grid"><section className="surface" aria-label={t.creativeScope}><h2>{t.creativeScope}</h2>
      <p>{t.generation}</p><p>{t.uploads}</p><p>{t.seed}</p><p>{t.recovery}</p><Link className="button" to="/runtime">{t.runtime}</Link>
    </section><section className="surface soft" aria-label={t.metadata}><div className="section-heading"><h2>{t.metadata}</h2>
      <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>{t.refresh}</button></div><p>{t.defaults}</p>
      {query.isPending ? <Loading /> : query.isError ? <RuntimeReadFailure error={query.error} onRetry={() => void query.refetch()} /> : <>
        <small>{t.source}: <code>{query.data.source}</code><br />{t.prefix}: <code>{query.data.environment_prefix}</code></small>
        {properties && Object.keys(properties).length ? Object.entries(properties).map(([name, value]) => {
          const field = record(value);
          if (!field) return null;
          const rules = Object.fromEntries(Object.entries(field).filter(([key]) => !['default', 'title', 'description'].includes(key)));
          return <article className="runtime-setting" key={name} aria-label={name}><h3>{labels[name] ?? name}</h3><dl className="facts">
            <dt>{t.environment}</dt><dd><code>{query.data.environment_variables[name] ?? t.unspecified}</code></dd>
            <dt>{t.default}</dt><dd><code>{Object.hasOwn(field, 'default') ? JSON.stringify(field.default) : t.unspecified}</code></dd>
            <dt>{t.constraint}</dt><dd><code>{JSON.stringify(rules)}</code></dd>
          </dl></article>;
        }) : <p>{t.missing}</p>}
      </>}
    </section></div>
  </div>;
}
