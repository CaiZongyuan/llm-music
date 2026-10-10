import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createMusicClient, type GenerateCreate, type RequestRead } from '../src/index.js';
import { dataOf, startApi, terminal, type OwnedApi } from './support.js';

test('generated request contract recovers lost acknowledgements and explicit bodyless retry across restart', async () => {
  const api = await startApi();
  let reopened: OwnedApi | undefined;
  try {
    const projectKey = randomUUID();
    const project = dataOf(await api.client.POST('/projects', {
      body: { name: '  Exact request recovery  ' }, params: { header: { 'Idempotency-Key': projectKey } },
    }), 201);
    assert.deepEqual(dataOf(await api.client.POST('/projects', {
      body: { name: project.name, description: '' }, params: { header: { 'Idempotency-Key': projectKey } },
    })), project);
    const projectReceipt: RequestRead = dataOf(await api.client.GET('/requests/{request_id}', {
      params: { path: { request_id: projectKey } },
    }));
    assert.equal(projectReceipt.operation, 'create_project');
    assert.equal(projectReceipt.resource_type, 'project');
    assert.equal(projectReceipt.resource_id, project.id);
    assert.equal(projectReceipt.source_job_id, null);
    const changed = await api.client.POST('/projects', {
      body: { name: 'Another intent' }, params: { header: { 'Idempotency-Key': projectKey } },
    });
    assert.equal(changed.response.status, 409);
    assert.equal(changed.error?.error.code, 'idempotency_conflict');
    const another = dataOf(await api.client.POST('/projects', {
      body: { name: project.name }, params: { header: { 'Idempotency-Key': randomUUID() } },
    }), 201);
    assert.notEqual(another.id, project.id);
    const invalid = await api.client.POST('/projects', {
      body: { name: 'Rejected before creation' }, params: { header: { 'Idempotency-Key': 'invalid' } },
    });
    assert.equal(invalid.response.status, 422);
    assert.equal(dataOf(await api.client.GET('/projects')).length, 2);
    const unknown = await api.client.GET('/requests/{request_id}', { params: { path: { request_id: randomUUID() } } });
    assert.equal(unknown.response.status, 404);
    assert.equal(unknown.error?.error.code, 'request_not_found');

    const requestKey = randomUUID();
    const inputs: GenerateCreate = { style: 'gentle folk', lyrics: '[verse]\nRetain this frozen verse', seed: 2026271003, max_seconds: 35 };
    let submitted = 0;
    const lossy = createMusicClient({ baseUrl: api.baseUrl, fetch: async request => {
      const response = await fetch(request);
      if (request.method === 'POST') {
        submitted++;
        assert.equal(response.status, 202);
        await response.arrayBuffer();
        throw new Error('Test consumer lost the accepted response');
      }
      return response;
    } });
    await assert.rejects(lossy.POST('/projects/{project_id}/jobs/generate', {
      params: { path: { project_id: project.id }, header: { 'Idempotency-Key': requestKey } }, body: inputs,
    }), /lost the accepted response/);
    const receipt: RequestRead = dataOf(await api.client.GET('/requests/{request_id}', {
      params: { path: { request_id: requestKey } },
    }));
    assert.equal(receipt.operation, 'generate');
    assert.equal(receipt.resource_type, 'job');
    assert.equal(receipt.project_id, project.id);
    const original = await terminal(api, project.id, receipt.resource_id);
    assert.equal(original.status, 'failed');
    assert.deepEqual(original.inputs, inputs);
    assert.equal(submitted, 1, 'Reading the original receipt must not submit again');
    const jobPath = { project_id: project.id, job_id: original.id };
    const retryKey = randomUUID();
    const retry = dataOf(await api.client.POST('/projects/{project_id}/jobs/{job_id}/retry', {
      params: { path: jobPath, header: { 'Idempotency-Key': retryKey } },
    }), 202);
    assert.equal(retry.provenance.retry_of_job_id, original.id);
    assert.deepEqual(retry.inputs, inputs);
    assert.equal(dataOf(await api.client.POST('/projects/{project_id}/jobs/{job_id}/retry', {
      params: { path: jobPath, header: { 'Idempotency-Key': retryKey } },
    })).id, retry.id);
    assert.ok(api.requests.every(request => request.bytes === 0 && request.contentType === null));
    await terminal(api, project.id, retry.id);
    assert.equal(dataOf(await api.client.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } })).length, 2);
    await api.stop();
    reopened = await startApi({ dataDir: api.dataDir });
    assert.deepEqual(dataOf(await reopened.client.GET('/requests/{request_id}', {
      params: { path: { request_id: requestKey } },
    })), receipt);
    const retriedReceipt = dataOf(await reopened.client.GET('/requests/{request_id}', {
      params: { path: { request_id: retryKey } },
    }));
    assert.equal(retriedReceipt.operation, 'retry');
    assert.equal(retriedReceipt.source_job_id, original.id);
    assert.equal(retriedReceipt.resource_id, retry.id);
    assert.equal(dataOf(await reopened.client.POST('/projects/{project_id}/jobs/{job_id}/retry', {
      params: { path: jobPath, header: { 'Idempotency-Key': retryKey } },
    })).id, retry.id);
    assert.equal(dataOf(await reopened.client.POST('/projects/{project_id}/jobs/generate', {
      params: { path: { project_id: project.id }, header: { 'Idempotency-Key': requestKey } }, body: inputs,
    })).id, original.id);
    assert.equal(dataOf(await reopened.client.GET('/projects/{project_id}/jobs', { params: { path: { project_id: project.id } } })).length, 2);
  } finally {
    await api.stop();
    await reopened?.stop();
  }
});
