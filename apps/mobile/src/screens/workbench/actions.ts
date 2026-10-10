import type { createMobileSession } from '../../data/session.ts';
import type { components, JobRead } from '@llm-music/api-client';

export type WorkbenchSession = ReturnType<typeof createMobileSession>;

export function pendingJobRecords(session: WorkbenchSession, projectId: string, jobs: readonly JobRead[] | undefined) {
  return session.listIntents(projectId).filter(intent => ['generate', 'retry'].includes(intent.operation) &&
    intent.phase === 'confirmed' && intent.resourceId && !jobs?.some(job => job.id === intent.resourceId));
}

export function generationBlocked(session: WorkbenchSession, projectId: string, jobs: readonly JobRead[] | undefined) {
  return jobs === undefined || jobs.some(job => !['completed', 'failed', 'cancelled'].includes(job.status)) ||
    pendingJobRecords(session, projectId, jobs).length > 0 || session.listIntents(projectId).some(intent =>
      ['generate', 'retry'].includes(intent.operation) && ['prepared', 'unknown'].includes(intent.phase));
}

/** Explicit creator actions; durable identity and HTTP recovery belong to M3. */
export function createWorkbenchActions(session: WorkbenchSession) {
  return {
    createProject: async (rawName: string) => {
      const name = rawName.trim();
      if (!name) throw new Error('project_name_required');
      if (Array.from(name).length > 200) throw new Error('project_name_too_long');
      const intent = await session.prepareIntent({ operation: 'create_project', body: { name } });
      return session.submitIntent(intent.id);
    },
    generate: async (projectId: string, knownJobs: readonly JobRead[] | undefined) => {
      if (generationBlocked(session, projectId, knownJobs)) throw new Error('jobs_unconfirmed');
      const intent = await session.prepareGenerate(projectId);
      return session.submitIntent(intent.id);
    },
    recover: async (intentId: string) => {
      if (session.getSnapshot().connection !== 'connected') await session.verify();
      return session.recoverIntent(intentId);
    },
    retry: async (job: JobRead, knownJobs: readonly JobRead[] = [job]) => {
      if (!['failed', 'cancelled'].includes(job.status) || job.recovery_required) throw new Error('retry_unconfirmed');
      if (generationBlocked(session, job.project_id, knownJobs)) throw new Error('jobs_unconfirmed');
      const intent = await session.prepareIntent({ operation: 'retry', projectId: job.project_id, jobId: job.id });
      return session.submitIntent(intent.id);
    },
    saveVersion: async (candidate: components['schemas']['CandidateRead'], rawName: string, knownVersions: readonly components['schemas']['VersionRead'][] | undefined) => {
      const existing = session.listIntents(candidate.project_id).find(intent => intent.operation === 'save_version' &&
        intent.body.candidate_id === candidate.id && intent.resourceId);
      if (existing) return existing;
      if (knownVersions === undefined) throw new Error('versions_unconfirmed');
      if (knownVersions.some(version => version.candidate_id === candidate.id)) throw new Error('version_already_saved');
      const name = rawName.trim();
      if (!name) throw new Error('version_name_required');
      if (Array.from(name).length > 200) throw new Error('version_name_too_long');
      const intent = await session.prepareIntent({ operation: 'save_version', projectId: candidate.project_id,
        body: { candidate_id: candidate.id, name } });
      return session.submitIntent(intent.id);
    },
    sendPrepared: (intentId: string) => session.submitIntent(intentId),
    replay: async (intentId: string) => {
      if (session.getSnapshot().connection !== 'connected') await session.verify();
      return session.replayIntent(intentId);
    },
    cancel: (job: JobRead) => session.cancelJob(job.project_id, job.id),
  };
}
