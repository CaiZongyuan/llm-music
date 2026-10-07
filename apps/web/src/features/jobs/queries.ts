import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { JobRead } from '@llm-music/api-client';
import { api, dataOf } from '../../lib/api';

export const jobKeys = {
  list: (projectId: string) => ['projects', projectId, 'jobs'] as const,
  detail: (projectId: string, jobId: string) => ['projects', projectId, 'jobs', jobId] as const,
};
export function isActiveJob(job: JobRead) {
  return job.status === 'queued' || job.status === 'running';
}
function latestJob(previous: JobRead | undefined, next: JobRead): JobRead {
  if (!previous) return next;
  // Application terminal states are stable; phase has no ordering and may become null.
  if (!isActiveJob(previous) || (previous.status === 'running' && next.status === 'queued') || Date.parse(previous.updated_at) > Date.parse(next.updated_at)) return previous;
  return next;
}
async function invalidateCompletedResults(cache: QueryClient, projectId: string) {
  // Shared Project list boundaries: Assets (#32), Scores (#34), Candidates (#35).
  // Completion creates no Version. Cancel older reads before marking results stale.
  const keys = ['assets', 'scores', 'candidates'].map(resource => ['projects', projectId, resource] as const);
  await Promise.all(keys.map(queryKey => cache.cancelQueries({ queryKey, exact: true })));
  keys.forEach(queryKey => { void cache.invalidateQueries({ queryKey, exact: true }); });
}
export function projectJobsOptions(projectId: string) {
  return queryOptions<JobRead[]>({ queryKey: jobKeys.list(projectId), staleTime: 0, refetchInterval: 5_000,
    structuralSharing: (previous, next) => (next as JobRead[]).map(job => latestJob((previous as JobRead[] | undefined)?.find(item => item.id === job.id), job)),
    queryFn: async ({ signal, client }) => {
      const jobs = dataOf(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: projectId } }, signal }));
      const previous = client.getQueryData<JobRead[]>(jobKeys.list(projectId));
      if (jobs.some(job => job.status === 'completed' && previous?.find(item => item.id === job.id)?.status !== 'completed')) await invalidateCompletedResults(client, projectId);
      return jobs;
    } });
}
export function jobOptions(projectId: string, jobId: string) {
  return queryOptions<JobRead>({ queryKey: jobKeys.detail(projectId, jobId), staleTime: 0,
    refetchInterval: query => query.state.data && !isActiveJob(query.state.data) ? false : 1_500,
    structuralSharing: (previous, next) => latestJob(previous as JobRead | undefined, next as JobRead),
    queryFn: async ({ signal, client }) => {
      const job = dataOf(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: projectId, job_id: jobId } }, signal }));
      if (job.status === 'completed' && client.getQueryData<JobRead>(jobKeys.detail(projectId, jobId))?.status !== 'completed') await invalidateCompletedResults(client, projectId);
      return job;
    } });
}
export async function cacheSubmittedJob(cache: QueryClient, job: JobRead) {
  // A list read started before POST may still return an empty snapshot after submission.
  await cache.cancelQueries({ queryKey: jobKeys.list(job.project_id) });
  const existing = cache.getQueryData<JobRead>(jobKeys.detail(job.project_id, job.id));
  const value = latestJob(existing, job);
  const previous = existing ?? cache.getQueryData<JobRead[]>(jobKeys.list(job.project_id))?.find(item => item.id === job.id);
  if (value.status === 'completed' && previous?.status !== 'completed') await invalidateCompletedResults(cache, job.project_id);
  cache.setQueryData(jobKeys.detail(job.project_id, job.id), value);
  cache.setQueryData<JobRead[]>(jobKeys.list(job.project_id), previous => {
    const list = previous ?? [];
    return list.some(item => item.id === value.id) ? list.map(item => item.id === value.id ? value : item) : [...list, value];
  });
  void cache.invalidateQueries({ queryKey: jobKeys.list(job.project_id), exact: true });
}
