import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { projectOptions } from '../features/projects/queries';
import { useMessages } from '../features/preferences/Preferences';
import { projectMessages } from '../features/projects/messages';
import { ErrorNotice, Loading } from '../components/States';

function ProjectWorkspace() {
  const { projectId } = Route.useParams();
  const t = useMessages(projectMessages);
  const project = useQuery(projectOptions(projectId));
  if (project.isError) return <><ErrorNotice error={project.error} onRetry={() => void project.refetch()} /><Link className="button" to="/">{t.home}</Link></>;
  return <><div className="page-heading"><span className="eyebrow">A PLACE FOR YOUR MUSIC</span>{project.data
    ? <><h1>{project.data.name}</h1><p>{project.data.description || t.unnamed}</p><details className="record-details"><summary>{t.record}</summary><code>{project.data.id}</code></details></> : <Loading />}</div>
    <nav className="tabs" aria-label={t.workspace}>
      <Link to="/projects/$projectId/generate" params={{ projectId }} activeProps={{ className: 'active' }}>{t.generate}</Link>
      <Link to="/projects/$projectId" params={{ projectId }} activeOptions={{ exact: true }} activeProps={{ className: 'active' }}>{t.assets}</Link>
      <Link to="/projects/$projectId/transcribe" params={{ projectId }} activeProps={{ className: 'active' }}>{t.transcribe}</Link>
      <Link to="/projects/$projectId/cover" params={{ projectId }} activeProps={{ className: 'active' }}>{t.cover}</Link>
      <Link to="/projects/$projectId/scores" params={{ projectId }} activeProps={{ className: 'active' }}>{t.scores}</Link>
      <Link to="/projects/$projectId/lyrics" params={{ projectId }} activeProps={{ className: 'active' }}>{t.lyrics}</Link>
      <Link to="/projects/$projectId/versions" params={{ projectId }} activeProps={{ className: 'active' }}>{t.versions}</Link>
      <Link to="/projects/$projectId/jobs" params={{ projectId }} activeProps={{ className: 'active' }}>{t.task}</Link>
    </nav><Outlet /></>;
}
export const Route = createFileRoute('/projects/$projectId')({ component: ProjectWorkspace });
