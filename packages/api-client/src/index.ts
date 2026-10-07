import createClient, { type ClientOptions } from 'openapi-fetch';
import { jobEventsPath, type components, type paths } from './schema.js';

export type { components, paths } from './schema.js';
export type JobRead = components['schemas']['JobRead'];
export type JobEventRead = components['schemas']['JobEventRead'];
export type GenerateCreate = components['schemas']['GenerateCreate'];
export type ErrorResponse = components['schemas']['ErrorResponse'];

export function createMusicClient(options: ClientOptions) {
  return createClient<paths>(options);
}

export function jobEventsUrl(baseUrl: string, projectId: string, jobId: string): URL {
  const path = jobEventsPath.replace('{project_id}', encodeURIComponent(projectId))
    .replace('{job_id}', encodeURIComponent(jobId));
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    throw new TypeError('Job event URLs require an HTTP or HTTPS application base URL');
  }
  base.pathname = `${base.pathname.replace(/\/$/, '')}${path}`;
  base.search = '';
  base.hash = '';
  base.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return base;
}
