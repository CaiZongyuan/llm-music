import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { components, GenerateCreate } from '@llm-music/api-client';
import { api, dataOf } from '../../lib/api';
import { cacheSubmittedJob } from './queries';

export function useSubmitGenerate(projectId: string) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: async (body: GenerateCreate) => dataOf(await api.POST('/projects/{project_id}/jobs/generate', { params: { path: { project_id: projectId } }, body })), onSuccess: job => cacheSubmittedJob(cache, job) });
}
export function useSubmitTranscription(projectId: string) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: async (body: components['schemas']['TranscribeCreate']) => dataOf(await api.POST('/projects/{project_id}/transcriptions', { params: { path: { project_id: projectId } }, body })), onSuccess: job => cacheSubmittedJob(cache, job) });
}
