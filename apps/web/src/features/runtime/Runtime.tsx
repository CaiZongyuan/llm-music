import { Fragment } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { components } from '@llm-music/api-client';
import { Loading } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { jobMessages } from '../jobs/messages';
import { capabilitiesOptions, operationReady } from './capabilities';
import { diagnosticsOptions, healthOptions, modelsOptions } from './queries';
import { freshness, Observation, ObservedValue, Reasons, RuntimeReadFailure, useObservationClock } from './Observations';
import { runtimeMessages } from './runtime-messages';
import './runtime.css';

type Model = components['schemas']['ModelRead'];
type Memory = components['schemas']['MemoryMetricRead'];
function bytes(value: number | null) { return value === null ? '' : `${(value / 1073741824).toFixed(2)} GiB (${value.toLocaleString('en')} bytes)`; }
function label(dictionary: Record<string, string>, key: string) { return dictionary[key] ?? key; }
const primaryMemory = new Set(['cuda_device_total_bytes', 'cuda_device_free_bytes', 'cuda_device_used_bytes', 'runtime_torch_active_bytes']);
function MemoryReading({ metric, now }: { metric: Memory; now: number }) {
  const t = useMessages(runtimeMessages);
  return <div className="runtime-metric" aria-label={label(t, metric.name)}><small>{label(t, metric.name)}</small>
    <ObservedValue reading={metric} now={now}>{bytes(metric.value)}</ObservedValue>
    <small>{metric.name === 'comfy_available_proxy_bytes' ? t.proxyScope : metric.name.startsWith('cuda_device_') ? t.deviceScope : metric.name.startsWith('runtime_torch_') ? t.torchScope : metric.name.startsWith('runtime_reported_ram_') ? t.ramScope : t.processScope}</small>
  </div>;
}

function ModelStatus({ model, now }: { model: Model; now: number }) {
  const t = useMessages(runtimeMessages);
  const state = freshness(model.observation, now);
  const shown = state === 'fresh' ? model.state : state;
  return <article className="runtime-model" aria-label={model.name}><h3>{model.name}</h3><strong>{label(t, shown)}</strong>
    <Observation source={model.observation} now={now} /><Reasons reasons={model.reasons} />
    <details><summary>{t.details}</summary><dl className="facts">
      <dt>{t.provider}</dt><dd>{model.provider}</dd><dt>{t.repository}</dt><dd><code>{model.repository}</code></dd>
      <dt>{t.revision}</dt><dd><code>{model.revision}</code></dd><dt>{t.file}</dt><dd><code>{model.filename}</code></dd>
      <dt>{t.localPath}</dt><dd><code>{model.local_path}</code></dd><dt>{t.size}</dt><dd>{model.expected_size_bytes.toLocaleString('en')} bytes</dd>
      <dt>{t.expectedHash}</dt><dd><code>{model.expected_sha256}</code></dd><dt>{t.observedHash}</dt><dd><code>{model.observed_sha256 ?? t.unknown}</code></dd>
      <dt>{t.source}</dt><dd><code>{model.registry_source}</code><br /><code>{model.hash_source}</code></dd>
      <dt>{t.license}</dt><dd>{model.weights_license}{model.component_license_notes ? <small>{model.component_license_notes}</small> : null}</dd>
      <dt>{t.licenseSource}</dt><dd><code>{model.license_source}</code></dd>
    </dl></details>
  </article>;
}

export function Runtime() {
  const t = useMessages(runtimeMessages);
  const jt = useMessages(jobMessages);
  const now = useObservationClock();
  const health = useQuery(healthOptions());
  const capabilities = useQuery(capabilitiesOptions());
  const diagnostics = useQuery(diagnosticsOptions());
  const models = useQuery(modelsOptions());
  const fetching = health.isFetching || capabilities.isFetching || diagnostics.isFetching || models.isFetching;
  function refresh() { void Promise.all([health.refetch(), capabilities.refetch(), diagnostics.refetch(), models.refetch()]); }
  const d = diagnostics.data;
  const queue = d?.application_queue;
  return <div className="runtime-page"><header className="page-heading"><div className="section-heading"><h1>{t.title}</h1>
    <button type="button" disabled={fetching} onClick={refresh}>{t.refresh}</button></div><p>{t.subtitle}</p>
    {(health.data?.runtime.mode ?? d?.mode ?? models.data?.mode) === 'fake' ? <small>{t.fake}</small> : null}
    <div className="runtime-links"><Link className="button" to="/settings">{t.settings}</Link></div></header>
    <div className="workspace-grid">
      <section className="surface" aria-label={t.health}><h2>{t.health}</h2>
        {health.isPending ? <Loading /> : health.isError ? <RuntimeReadFailure error={health.error} onRetry={refresh} /> : <>
          <dl className="facts"><dt>{t.backend}</dt><dd><strong>{freshness(health.data.backend.observation, now) === 'fresh' ? t.reachable : t.stale}</strong><Observation source={health.data.backend.observation} now={now} /></dd>
            <dt>{t.backendVersion}</dt><dd>{health.data.backend.version}</dd><dt>{t.python}</dt><dd>{health.data.backend.python_version}</dd>
            <dt>{t.runtime}</dt><dd><strong>{!health.data.runtime.reachable ? t.notReachable : freshness(health.data.runtime.observation, now) !== 'fresh' ? t.stale : t[health.data.runtime.status]}</strong><Observation source={health.data.runtime.observation} now={now} /></dd>
          </dl><Reasons reasons={health.data.runtime.reasons} />
        </>}
        {capabilities.isPending ? <Loading /> : capabilities.isError ? <RuntimeReadFailure error={capabilities.error} onRetry={refresh} /> : capabilities.data.capabilities.map(capability => <div className="runtime-metric" key={capability.operation}>
          <h3>{t[capability.operation]}</h3><strong>{operationReady(capabilities.data, capability.operation) ? t.ready : t.not_ready}</strong>
          <Observation source={capability.observation} now={now} /><Reasons reasons={capability.reasons} />
        </div>)}
      </section>
      <section className="surface soft" aria-label={t.devices}><h2>{t.devices}</h2>
        {diagnostics.isPending ? <Loading /> : diagnostics.isError ? <RuntimeReadFailure error={diagnostics.error} onRetry={refresh} /> : d ? <>
          <dl className="facts"><dt>{t.gpu}</dt><dd><ObservedValue reading={d.gpu_name} now={now}>{d.gpu_name.value}</ObservedValue></dd>
            <dt>{t.loaded}</dt><dd><ObservedValue reading={d.loaded_models} now={now}>{d.loaded_models.value?.join(', ')}</ObservedValue><small>{t.noLoaded}</small></dd>
          </dl><h3>{t.memory}</h3>{d.memory.filter(metric => primaryMemory.has(metric.name)).map(metric => <MemoryReading key={metric.name} metric={metric} now={now} />)}
          <details><summary>{t.moreMemory}</summary>{d.memory.filter(metric => !primaryMemory.has(metric.name)).map(metric => <MemoryReading key={metric.name} metric={metric} now={now} />)}</details>
        </> : null}
      </section>
      <section className="surface" aria-label={t.models}><h2>{t.models}</h2>
        {models.isPending ? <Loading /> : models.isError ? <RuntimeReadFailure error={models.error} onRetry={refresh} /> : <>
          {models.data.models.length ? models.data.models.map(model => <ModelStatus key={model.id} model={model} now={now} />) : <p>{t.noModels}</p>}
          <details><summary>{t.codeRegistry}</summary>{models.data.code_registry.map(code => <dl key={code.component} className="facts"><dt>{code.component}</dt><dd><code>{code.expected_revision}</code><small>{code.code_license ?? t.unknown}</small><code>{code.registry_source}</code><br /><code>{code.license_source ?? t.unknown}</code></dd></dl>)}</details>
        </>}
      </section>
      <section className="surface soft" aria-label={t.queue}><h2>{t.queue}</h2><p>{t.queueScope}</p>
        {diagnostics.isPending ? <Loading /> : diagnostics.isError ? <RuntimeReadFailure error={diagnostics.error} onRetry={refresh} /> : queue && d ? <>
          {freshness(queue.observation, now) === 'fresh' ? <dl className="facts"><dt>{t.queued}</dt><dd>{queue.queued}</dd><dt>{t.running}</dt><dd>{queue.running}</dd></dl> : <strong>{t.stale}</strong>}
          <Observation source={queue.observation} now={now} />
          <dl className="facts"><dt>{t.current}</dt><dd><ObservedValue reading={queue.recorded_running_job} now={now}><code>{queue.recorded_running_job.value}</code></ObservedValue></dd>
            <dt>{t.nativeQueue}</dt><dd><ObservedValue reading={d.native_queue_occupancy} now={now}>{d.native_queue_occupancy.value}</ObservedValue></dd></dl>
          {queue.jobs.length ? queue.jobs.map(job => <article className="job-card" key={job.id} aria-label={job.id}>
            <strong>{t[job.operation]} · {job.status === 'queued' ? t.queuedJob : t.runningJob}</strong>
            {job.phase ? <p>{t.phase}: {label(jt, job.phase)}</p> : null}
            <Link to="/projects/$projectId" params={{ projectId: job.project_id }}><code>{job.id}</code></Link>
            <Observation source={job.observation} now={now} />
          </article>) : <p>{t.emptyQueue}</p>}
        </> : null}
      </section>
      <section className="surface" aria-label={t.versions}><h2>{t.versions}</h2>
        {diagnostics.isPending ? <Loading /> : diagnostics.isError ? <RuntimeReadFailure error={diagnostics.error} onRetry={refresh} /> : d ? <dl className="facts">
          {Object.entries(d.versions).map(([name, value]) => <Fragment key={name}><dt>{name === 'python' ? 'Python' : label(t, name)}</dt><dd><ObservedValue reading={value} now={now}><code>{value.value}</code></ObservedValue></dd></Fragment>)}
        </dl> : null}
      </section>
    </div>
  </div>;
}
