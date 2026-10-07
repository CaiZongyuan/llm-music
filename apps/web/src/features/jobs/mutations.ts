import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { components, GenerateCreate } from '@llm-music/api-client';
import { api, dataOf } from '../../lib/api';
import { cacheSubmittedJob, jobKeys } from './queries';

export function useSubmitGenerate(projectId: string) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: async (body: GenerateCreate) => dataOf(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: projectId } }, body })), onSuccess: job => cacheSubmittedJob(cache, job) });
}
export function useCancelJob(projectId: string, jobId: string) {
  const cache = useQueryClient();
  return useMutation({ retry: false,
    mutationFn: async () => dataOf(await api.POST('/projects/{project_id}/jobs/{job_id}/cancel', { params: { path: { project_id: projectId, job_id: jobId } } })),
    onSuccess: job => cacheSubmittedJob(cache, job),
    onError: () => { void cache.invalidateQueries({ queryKey: jobKeys.detail(projectId, jobId), exact: true }); },
  });
}
export function useRetryJob(projectId: string, jobId: string) {
  const cache = useQueryClient();
  return useMutation({ retry: false,
    mutationFn: async () => dataOf(await api.POST('/projects/{project_id}/jobs/{job_id}/retry', { params: { path: { project_id: projectId, job_id: jobId } } })),
    onSuccess: job => cacheSubmittedJob(cache, job),
    onError: () => { void cache.invalidateQueries({ queryKey: jobKeys.list(projectId), exact: true }); },
  });
}
export function useSubmitTranscription(projectId: string) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: async (body: components['schemas']['TranscribeCreate']) => dataOf(await api.POST('/projects/{project_id}/transcriptions', { params: { path: { project_id: projectId } }, body })), onSuccess: job => cacheSubmittedJob(cache, job) });
}
