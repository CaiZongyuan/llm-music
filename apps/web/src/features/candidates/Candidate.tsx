import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@llm-music/api-client';
import { ErrorNotice, Loading } from '../../components/States';
import { api, dataOf } from '../../lib/api';
import { useMessages } from '../preferences/Preferences';
import { selectPlayerAsset } from '../player';
import { generationMessages } from '../generation/messages';
import { InputsSnapshot } from '../generation/InputsSnapshot';
import { useGenerationDraft } from '../generation/drafts';
import { versionKeys, versionsOptions } from '../versions/queries';
import { candidateOptions } from './queries';

function SaveCandidate({ candidate }: { candidate: components['schemas']['CandidateRead'] }) {
  const t = useMessages(generationMessages);
  const cache = useQueryClient();
  const versions = useQuery(versionsOptions(candidate.project_id));
  const saved = versions.data?.find(version => version.candidate_id === candidate.id);
  const [name, setName] = useState('');
  const save = useMutation({ mutationFn: async () => dataOf(await api.POST('/projects/{project_id}/versions', { params: { path: { project_id: candidate.project_id } }, body: { candidate_id: candidate.id, name: name.trim() } })),
    onSuccess: async version => {
      await cache.cancelQueries({ queryKey: versionKeys.list(candidate.project_id) });
      cache.setQueryData(versionKeys.detail(candidate.project_id, version.id), version);
      cache.setQueryData<components['schemas']['VersionRead'][]>(versionKeys.list(candidate.project_id), previous => {
        const list = previous ?? [];
        return list.some(item => item.id === version.id) ? list.map(item => item.id === version.id ? version : item) : [...list, version];
      });
      void cache.invalidateQueries({ queryKey: versionKeys.list(candidate.project_id), exact: true });
    }, retry: false });
  if (versions.isPending) return <Loading />;
  if (versions.isError) return <ErrorNotice error={versions.error} onRetry={() => void versions.refetch()} />;
  if (saved) return <div className="saved-candidate"><span className="tag">{t.saved}</span><Link className="button" to="/projects/$projectId/versions/$versionId" params={{ projectId: candidate.project_id, versionId: saved.id }}>{t.openVersion}</Link></div>;
  return <form className="save-candidate" onSubmit={event => { event.preventDefault(); if (!save.isPending) save.mutate(); }}>
    <p className="field-help">{t.saveIntro}</p><label>{t.name}<input value={name} maxLength={200} required onChange={event => setName(event.target.value)} /></label>
    {save.isError ? <><ErrorNotice error={save.error} /><button type="button" onClick={() => void versions.refetch()}>{t.checkSaved}</button></> : null}
    <button className="primary" disabled={save.isPending || !name.trim()}>{save.isPending ? t.saving : t.save}</button>
  </form>;
}

export function Candidate({ projectId, candidateId }: { projectId: string; candidateId: string }) {
  const t = useMessages(generationMessages);
  const result = useQuery(candidateOptions(projectId, candidateId));
  const [, updateDraft] = useGenerationDraft(projectId);
  if (result.isPending) return <Loading />;
  if (result.isError) return <ErrorNotice error={result.error} onRetry={() => void result.refetch()} />;
  const candidate = result.data;
  return <section className="surface candidate-detail" aria-label={t.latest} data-candidate-id={candidate.id}>
    <h2>{t.latest}</h2><p className="hint">{t.decide}</p><div className="feature-actions"><button type="button" className="primary" onClick={() => selectPlayerAsset({ projectId, assetId: candidate.audio_asset_id, label: candidate.inputs.style })}>{t.listen}</button>
      <Link className="button" to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: candidate.score_id }}>{t.score}</Link>
      <button type="button" onClick={() => updateDraft({ style: candidate.inputs.style, lyrics: candidate.inputs.lyrics, seed: String(candidate.inputs.seed) })}>{t.reuse}</button></div>
    {candidate.provenance.runtime_kind === 'fake' ? <p className="field-help fixture-notice">{t.fake}</p> : null}
    <InputsSnapshot inputs={candidate.inputs} provenance={candidate.provenance} />
    <SaveCandidate key={candidate.id} candidate={candidate} />
    <details className="record-details"><summary>{t.record}</summary><code>{candidate.id}</code><code>{candidate.job_id}</code><code>{candidate.audio_asset_id}</code><code>{candidate.score_id}</code></details>
  </section>;
}
