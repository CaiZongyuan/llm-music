import { queryOptions, type QueryClient } from '@tanstack/react-query';
import type { JobRead } from '@llm-music/api-client';
import { api, dataOf } from '../../lib/api';

export const jobKeys = {
  list: (projectId: string) => ['projects', projectId, 'jobs'] as const,
  detail: (projectId: string, jobId: string) => ['projects', projectId, 'jobs', jobId] as const,
};
export function projectJobsOptions(projectId: string) {
  return queryOptions({ queryKey: jobKeys.list(projectId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/jobs', { params: { path: { project_id: projectId } }, signal })) });
}
export function jobOptions(projectId: string, jobId: string) {
  return queryOptions({ queryKey: jobKeys.detail(projectId, jobId), queryFn: async ({ signal }) => dataOf(await api.GET('/projects/{project_id}/jobs/{job_id}', { params: { path: { project_id: projectId, job_id: jobId } }, signal })) });
}
export async function cacheSubmittedJob(cache: QueryClient, job: JobRead) {
  // A list read started before POST may still return an empty snapshot after submission.
  await cache.cancelQueries({ queryKey: jobKeys.list(job.project_id) });
  const existing = cache.getQueryData<JobRead>(jobKeys.detail(job.project_id, job.id));
  const value = existing && existing.updated_at > job.updated_at ? existing : job;
  cache.setQueryData(jobKeys.detail(job.project_id, job.id), value);
  cache.setQueryData<JobRead[]>(jobKeys.list(job.project_id), previous => {
    const list = previous ?? [];
    return list.some(item => item.id === value.id) ? list.map(item => item.id === value.id ? value : item) : [...list, value];
  });
  void cache.invalidateQueries({ queryKey: jobKeys.list(job.project_id), exact: true });
}
