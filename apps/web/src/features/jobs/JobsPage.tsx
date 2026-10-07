import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Loading, ErrorNotice } from '../../components/States';
import { projectsOptions } from '../projects/queries';
import { useMessages } from '../preferences/Preferences';
import { jobMessages } from './messages';
import { ProjectJobs } from './JobState';

export function JobsPage() {
  const t = useMessages(jobMessages);
  const projects = useQuery(projectsOptions());
  return <><div className="page-heading"><h1>{t.jobsPage}</h1><p>{t.jobsBody}</p></div>
    {projects.isPending ? <Loading /> : projects.isError ? <ErrorNotice error={projects.error} onRetry={() => void projects.refetch()} /> : projects.data.length === 0
      ? <div className="empty"><p>{t.noProjects}</p><Link className="button" to="/">{t.project}</Link></div>
      : <div className="global-jobs">{projects.data.map(project => <section key={project.id}><div className="section-heading"><h2>{project.name}</h2><Link className="inline-link" to="/projects/$projectId/jobs" params={{ projectId: project.id }}>{t.project}</Link></div><ProjectJobs projectId={project.id} /></section>)}</div>}
  </>;
}
