import { createMusicClient, type components, type ErrorResponse } from '@llm-music/api-client';

export const api = createMusicClient({ baseUrl: '/api' });
export type ProjectRead = components['schemas']['ProjectRead'];
export type AssetRead = components['schemas']['AssetRead'];

export class ApiFailure extends Error {
  constructor(public readonly status: number, public readonly detail?: ErrorResponse['error']) {
    super(detail?.code ?? 'request_failed');
  }
}

export function dataOf<T>(result: { data?: T; error?: ErrorResponse | string; response: Response }): T {
  const detail = typeof result.error === 'object' ? result.error.error : undefined;
  if (!result.response.ok || result.data === undefined) throw new ApiFailure(result.response.status, detail);
  return result.data;
}
