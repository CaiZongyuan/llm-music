// An independent public consumer: result queries unmount while only Jobs are open.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { PreferencesProvider } from '../src/features/preferences/Preferences';
import { JobState, JobStatus, projectJobsOptions } from '../src/features/jobs';
import { assetsOptions } from '../src/features/assets/queries';
import { createQueryClient } from '../src/lib/query-client';
import { api, dataOf } from '../src/lib/api';
import '../src/styles.css';

const parameters = new URLSearchParams(location.search);
const projectId = parameters.get('projectId');
const jobId = parameters.get('jobId');
if (!projectId || !jobId) throw new Error('An owned Project and Job are required');
if (dataOf(await api.GET('/health')).runtime.mode !== 'fake') throw new Error('This result consumer requires CPU FakeRuntime');

function Results({ projectId }: { projectId: string }) {
  const assets = useQuery(assetsOptions(projectId));
  // These are the published sibling list keys, consumed through generated HTTP.
  // No completion effect, invalidation call or internal Monitor method exists here.
  const scores = useQuery({ queryKey: ['projects', projectId, 'scores'], queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/scores', { params: { path: { project_id: projectId } }, signal })) });
  const candidates = useQuery({ queryKey: ['projects', projectId, 'candidates'], queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/candidates', { params: { path: { project_id: projectId } }, signal })) });
  return <section aria-label="Saved results"><p>Assets: <output aria-label="Asset count">{assets.data?.length ?? 'Reading'}</output></p>
    <p>Scores: <output aria-label="Score count">{scores.data?.length ?? 'Reading'}</output></p>
    <p>Candidates: <output aria-label="Candidate count">{candidates.data?.length ?? 'Reading'}</output></p>
    <ul>{assets.data?.map(asset => <li key={asset.id}>{asset.id}</li>)}{scores.data?.map(score => <li key={score.id}>{score.id}</li>)}{candidates.data?.map(candidate => <li key={candidate.id}>{candidate.id}</li>)}</ul>
  </section>;
}
function ListOnly({ projectId }: { projectId: string }) {
  const jobs = useQuery(projectJobsOptions(projectId));
  return <section aria-label="Only Job list"><button type="button" onClick={() => void jobs.refetch()}>Read Job list</button>{jobs.data?.map(job => <JobStatus key={job.id} job={job} />)}</section>;
}
function Consumer({ projectId, jobId }: { projectId: string; jobId: string }) {
  const [results, showResults] = useState(true);
  return <main><h1>Job result consumer fixture</h1><p>CPU FakeRuntime only. Server lists use the application's fifteen-second freshness window.</p>
    <button type="button" onClick={() => showResults(false)}>Observe only Jobs</button><button type="button" onClick={() => showResults(true)}>Return to saved results</button>
    {results ? <Results projectId={projectId} /> : parameters.get('observer') === 'list' ? <ListOnly projectId={projectId} /> : <JobState projectId={projectId} jobId={jobId} />}
  </main>;
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing fixture root');
createRoot(root).render(<PreferencesProvider><QueryClientProvider client={createQueryClient()}><Consumer projectId={projectId} jobId={jobId} /></QueryClientProvider></PreferencesProvider>);
