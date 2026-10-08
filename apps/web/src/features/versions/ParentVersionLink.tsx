import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMessages } from '../preferences/Preferences';
import { versionMessages } from './messages';
import { versionOptions } from './queries';

export function ParentVersionLink({ projectId, versionId }: { projectId: string; versionId?: string | null }) {
  const t = useMessages(versionMessages);
  const version = useQuery({ ...versionOptions(projectId, versionId ?? ''), enabled: Boolean(versionId) });
  return versionId ? <Link to="/projects/$projectId/versions/$versionId" params={{ projectId, versionId }}>{version.data?.name ?? versionId}</Link> : <span>{t.none}</span>;
}
