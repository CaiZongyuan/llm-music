import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, dataOf, type ProjectRead } from '../../lib/api';
import { ErrorNotice, Loading } from '../../components/States';
import { useMessages } from '../preferences/Preferences';
import { projectMessages } from './messages';
import { projectKeys, projectsOptions } from './queries';

export function Library() {
  const t = useMessages(projectMessages);
  const projects = useQuery(projectsOptions());
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useMutation({
    mutationFn: async () => dataOf(await api.POST('/projects', { body: { name: name.trim(), description } })),
    onSuccess: async project => {
      await cache.cancelQueries({ queryKey: projectKeys.list, exact: true });
      cache.setQueryData<ProjectRead[]>(projectKeys.list, previous => [...(previous ?? []).filter(item => item.id !== project.id), project]);
      cache.setQueryData(projectKeys.detail(project.id), project);
      // Creation may finish before the first Library read; recover the complete list.
      void cache.invalidateQueries({ queryKey: projectKeys.list, exact: true });
      await navigate({ to: '/projects/$projectId', params: { projectId: project.id } });
    },
  });
  function submit(event: FormEvent) { event.preventDefault(); if (name.trim()) create.mutate(); }
  return <><div className="page-heading"><span className="eyebrow">A PLACE FOR YOUR NEXT IDEA</span><h1>{t.title}</h1><p>{t.subtitle}</p></div>
    <div className="library-grid"><section className="surface"><h2>{t.new}</h2><form onSubmit={submit}>
      <label>{t.name}<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} placeholder={t.nameHint} /></label>
      <label>{t.note}<textarea maxLength={2000} rows={4} value={description} onChange={event => setDescription(event.target.value)} placeholder={t.noteHint} /></label>
      {create.isError ? <ErrorNotice error={create.error} onRetry={() => void projects.refetch()} /> : null}
      <button className="primary" type="submit" disabled={!name.trim() || create.isPending}>{create.isPending ? t.creating : t.create}<span aria-hidden="true"> →</span></button>
    </form></section><section className="project-collection" aria-label={t.workspace}>
      {projects.isPending ? <Loading /> : projects.isError ? <ErrorNotice error={projects.error} onRetry={() => void projects.refetch()} /> : projects.data.length === 0
        ? <div className="empty surface"><span className="empty-mark" aria-hidden="true">♫</span><h2>{t.empty}</h2><p>{t.emptyBody}</p></div>
        : <><small className="collection-count">{projects.data.length} {t.count}</small>{projects.data.map(project => <Link className="project-card" key={project.id} to="/projects/$projectId" params={{ projectId: project.id }}>
          <span className="album-mark" aria-hidden="true">♪</span><div><h2>{project.name}</h2><p>{project.description || t.unnamed}</p><span className="inline-link">{t.open} →</span></div>
        </Link>)}</>}
    </section></div></>;
}
