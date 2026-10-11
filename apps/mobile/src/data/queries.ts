import { useQuery } from '@tanstack/react-query';
import { useMobileSession } from './provider';

type Session = ReturnType<typeof useMobileSession>['session'];

function useScopedQuery<T>(key: readonly unknown[], load: (session: Session) => Promise<T>, enabled = true) {
  const { session, state } = useMobileSession();
  return useQuery({
    queryKey: ['mobile', state.server?.serverId ?? null, state.server?.deviceId ?? null, ...key],
    queryFn: () => load(session), enabled: enabled && state.foreground && state.connection === 'connected',
  });
}

// Callers use data === undefined for initial/prerequisite states. A refresh
// error can coexist with cached data; [] is empty only after a successful read.
export const useProjects = () => useScopedQuery(['projects'], session => session.getProjects());
export const useProject = (projectId: string) => useScopedQuery(['project', projectId], session => session.getProject(projectId), !!projectId);
export const useJobs = (projectId: string) => useScopedQuery(['jobs', projectId], session => session.getJobs(projectId), !!projectId);
export const useJob = (projectId: string, jobId: string) => useScopedQuery(['job', projectId, jobId], session => session.getJob(projectId, jobId), !!projectId && !!jobId);
export const useCandidates = (projectId: string) => useScopedQuery(['candidates', projectId], session => session.getCandidates(projectId), !!projectId);
export const useVersions = (projectId: string) => useScopedQuery(['versions', projectId], session => session.getVersions(projectId), !!projectId);
export const useCandidate = (projectId: string, candidateId: string) => useScopedQuery(['candidate', projectId, candidateId], session => session.getCandidate(projectId, candidateId), !!projectId && !!candidateId);
export const useVersion = (projectId: string, versionId: string) => useScopedQuery(['version', projectId, versionId], session => session.getVersion(projectId, versionId), !!projectId && !!versionId);
