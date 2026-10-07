import { createMusicClient, type components, type ErrorResponse } from '@llm-music/api-client';

export const api = createMusicClient({ baseUrl: '/api' });
export type ProjectRead = components['schemas']['ProjectRead'];
export type AssetRead = components['schemas']['AssetRead'];

export class ApiFailure extends Error {
  constructor(public readonly status: number, public readonly detail?: ErrorResponse['error']) {
    super(detail?.code ?? 'request_failed');
  }
}

export function dataOf<T>(result: { data?: T; error?: ErrorResponse; response: Response }): T {
  if (!result.response.ok || result.data === undefined) throw new ApiFailure(result.response.status, result.error?.error);
  return result.data;
}
