// Browser-only test consumer of the public feature boundary; excluded from the production build.
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from '../src/features/preferences/Preferences';
import { ProjectJobs, JobState, useSubmitGenerate } from '../src/features/jobs';
import { createQueryClient } from '../src/lib/query-client';
import { api, dataOf } from '../src/lib/api';
import '../src/styles.css';

const parameters = new URLSearchParams(location.search);
const projectA = parameters.get('a');
const projectB = parameters.get('b');
if (!projectA || !projectB) throw new Error('Two owned fixture Projects are required');
if (dataOf(await api.GET('/health')).runtime.mode !== 'fake') throw new Error('The test consumer only submits to CPU Fake Runtime');
function Consumer({ a, b }: { a: string; b: string }) {
  const submit = useSubmitGenerate(a);
  return <main><h1>Shared Job consumer fixture</h1><p>CPU Fake Runtime. No real music inference.</p>
    <button type="button" disabled={submit.isPending} onClick={() => submit.mutate({ style: 'gentle piano', lyrics: '[Verse]\nA small melody', seed: 32001 })}>Submit fixture job to A</button>
    <section aria-label="Project A"><ProjectJobs projectId={a} />{submit.data ? <JobState projectId={a} jobId={submit.data.id} /> : null}</section>
    <section aria-label="Project B"><ProjectJobs projectId={b} /></section>
  </main>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing fixture root');
createRoot(root).render(<PreferencesProvider><QueryClientProvider client={createQueryClient()}><Consumer a={projectA} b={projectB} /></QueryClientProvider></PreferencesProvider>);
