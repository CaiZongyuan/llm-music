import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { components } from '@llm-music/api-client';
import type { NoteTimingEvent } from 'abcjs';
import { ErrorNotice, Loading } from '../../components/States';
import { api, ApiFailure, dataOf } from '../../lib/api';
import { assetKeys } from '../assets/queries';
import { useMessages } from '../preferences/Preferences';
import { scorePlayback, selectPlayerScore, subscribeScorePlayback, type ScorePlayback } from '../player';
import { versionOptions, versionsOptions } from '../versions/queries';
import { versionMessages } from '../versions/messages';
import { VersionInputReuse } from '../versions/VersionInputReuse';
import '../versions/versions.css';
import { scoreKeys } from './queries';
import { useScoreDraft } from './drafts';
import { editorMessages } from './editor-messages';
import { auditionMidi, downloadMidi, MidiError, readMidi } from './midi';
import { loadABCJS } from './abcjs';
import { ScoreGeneration } from './ScoreGeneration';

type Score = components['schemas']['ScoreRead'];
type SaveIntent = components['schemas']['ScoreCreate'];
type SaveRequest = { intent: SaveIntent; revision: number; abcSha256: string };
type CheckedScore = { abc: string; revision: number; host: HTMLDivElement; midi: Uint8Array; timings: NoteTimingEvent[]; abcSha256: string };
type CheckError = { kind: 'notation' | 'native' | 'network' | 'headers' | 'midi'; detail?: string };

function warningText(warnings: string[]) {
  return warnings.join('\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

export function ScoreEditor({ projectId, score, initialABC, generation, branchVersionId }: { projectId: string; score?: Score; initialABC: string; generation?: ReactNode; branchVersionId?: string }) {
  const t = useMessages(editorMessages);
  const v = useMessages(versionMessages);
  const cache = useQueryClient();
  // Branch entry preserves ABC, but requires a choice in this editor instance.
  const branchSelectionContext = useRef(Symbol(branchVersionId)).current;
  const context = branchVersionId === undefined ? 'score' : branchSelectionContext;
  const [draft, edit, select, check] = useScoreDraft(projectId, score?.id ?? 'new', initialABC, context);
  const versions = useQuery({ ...versionsOptions(projectId), enabled: Boolean(score) });
  const branch = useQuery({ ...versionOptions(projectId, branchVersionId ?? ''), enabled: Boolean(branchVersionId) });
  const branchReady = branchVersionId === undefined || Boolean(branch.isSuccess && branch.data.id === branchVersionId && branch.data.project_id === projectId && branch.data.score_id === score?.id);
  const sourceReady = (!score || versions.isSuccess) && branchReady;
  // Only an explicit, verified Version action changes this editor's origin.
  // Ordinary Scores retain their existing Reference/editing parent.
  const parentId = branchVersionId === undefined
    ? score?.parent_version_id ?? versions.data?.find(version => version.score_id === score?.id)?.id ?? null
    : branchReady ? branchVersionId : null;
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'checking' | 'valid' | 'invalid'>('checking');
  const [checked, setChecked] = useState<CheckedScore | null>(null);
  const [checkError, setCheckError] = useState<CheckError | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const notation = useRef<HTMLDivElement>(null);
  const recoveryId = useRef<string | null>(null);
  const current = status === 'valid' && checked?.abc === draft.abc;
  const selectionMatches = draft.selectedContext === context && draft.selected?.parent_version_id === parentId;
  const ready = current && sourceReady && selectionMatches && draft.selected?.abc === draft.abc;

  useEffect(() => {
    const captured = { abc: draft.abc, revision: draft.revision };
    let active = true;
    const controller = new AbortController();
    check(null);
    setStatus('checking'); setCheckError(null); setMediaError(null);
    const timer = setTimeout(() => {
      void (async () => {
        if (!/^X:\s*\d+/m.test(captured.abc) || !/^K:\s*\S+/m.test(captured.abc) || (captured.abc.match(/^X:/gm) ?? []).length !== 1) {
          if (active) { setStatus('invalid'); setCheckError({ kind: 'headers' }); }
          return;
        }
        const host = document.createElement('div');
        let midi: Uint8Array;
        let timings: NoteTimingEvent[];
        try {
          const library = await loadABCJS();
          if (!active) return;
          const [tune] = library.renderAbc(host, captured.abc, { responsive: 'resize', add_classes: true, staffwidth: 470, wrap: { minSpacing: 1.5, maxSpacing: 2.7, preferredMeasuresPerLine: 4 } });
          if (!tune || !host.querySelector('svg')) throw new Error('No notation');
          if (tune.warnings?.length) {
            setStatus('invalid'); setCheckError({ kind: 'notation', detail: warningText(tune.warnings) }); return;
          }
          const binary: unknown = library.synth.getMidiFile(tune, { midiOutputType: 'binary' });
          if (!(binary instanceof Uint8Array)) throw new MidiError('invalid');
          midi = binary;
          readMidi(midi);
          // Read abcjs's timing map without starting its separate animation clock.
          timings = new library.TimingCallbacks(tune).noteTimings;
        } catch (error) {
          if (active) { setStatus('invalid'); setCheckError({ kind: error instanceof MidiError ? 'midi' : 'notation', detail: error instanceof MidiError ? error.reason : undefined }); }
          return;
        }
        try {
          const validation = dataOf(await api.POST('/projects/{project_id}/scores/validate', { params: { path: { project_id: projectId } }, body: { abc: captured.abc }, signal: controller.signal }));
          if (!active) return;
          setChecked({ ...captured, host, midi, timings, abcSha256: validation.abc_sha256 }); setStatus('valid');
          check(captured.abc);
        } catch (error) {
          if (!active) return;
          setStatus('invalid');
          setCheckError(error instanceof ApiFailure && error.detail?.code === 'score_invalid' ? { kind: 'native', detail: error.detail.message } : { kind: 'network' });
        }
      })();
    }, 400);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [projectId, draft.abc, draft.revision, attempt]);

  useEffect(() => { if (checked) notation.current?.replaceChildren(checked.host); }, [checked]);

  useEffect(() => {
    const host = checked?.host;
    const clear = () => host?.querySelectorAll('.highlight').forEach(element => element.classList.remove('highlight'));
    function sync(playback: ScorePlayback) {
      clear();
      if (!current || !checked || !playback?.playing || playback.projectId !== projectId || playback.abcSha256 !== checked.abcSha256) return;
      const event = checked.timings.filter(item => item.milliseconds <= playback.time * 1000).at(-1);
      if (event?.type === 'event') event.elements?.flat().forEach(element => element?.classList.add('highlight'));
    }
    sync(scorePlayback());
    const unsubscribe = subscribeScorePlayback(sync);
    return () => { unsubscribe(); clear(); };
  }, [checked, current, projectId]);

  const save = useMutation({
    mutationFn: async ({ intent }: SaveRequest) => {
      if (recoveryId.current) return dataOf(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { project_id: projectId, score_id: recoveryId.current } } }));
      try {
        return dataOf(await api.POST('/projects/{project_id}/scores', { params: { path: { project_id: projectId } }, body: intent }));
      } catch (error) {
        if (error instanceof ApiFailure && error.detail?.code === 'score_commit_unconfirmed' && error.detail.resource_id) {
          recoveryId.current = error.detail.resource_id;
          return dataOf(await api.GET('/projects/{project_id}/scores/{score_id}', { params: { path: { project_id: projectId, score_id: recoveryId.current } } }));
        }
        throw error;
      }
    },
    onSuccess: (saved, { intent, revision, abcSha256 }) => {
      recoveryId.current = null;
      cache.setQueryData(scoreKeys.detail(projectId, saved.id), saved);
      cache.setQueryData(scoreKeys.abc(projectId, saved.abc_asset_id), intent.abc);
      void cache.invalidateQueries({ queryKey: scoreKeys.list(projectId) });
      void cache.invalidateQueries({ queryKey: assetKeys.list(projectId) });
      // The submitted snapshot is immutable even when text changes during save.
      select({ abc: intent.abc, source_score_id: saved.id, parent_version_id: saved.parent_version_id, revision, abcSha256 });
    },
  });
  function saveCurrent() {
    if (!current || !checked || !sourceReady || save.isPending || save.isError || recoveryId.current) return;
    if (score && checked.abc === initialABC) {
      select({ abc: checked.abc, source_score_id: score.id, parent_version_id: parentId, revision: checked.revision, abcSha256: checked.abcSha256 });
      return;
    }
    save.mutate({ intent: { save_id: crypto.randomUUID(), abc: checked.abc, source_score_id: score?.id ?? null, parent_version_id: parentId }, revision: checked.revision, abcSha256: checked.abcSha256 });
  }
  function audition() {
    if (!current || !checked) return;
    try {
      const audio = auditionMidi(checked.midi);
      selectPlayerScore({ kind: 'score', projectId, id: `${checked.abcSha256}:${crypto.randomUUID()}`, label: `${t.draft} MIDI · r${checked.revision}`, revision: checked.revision, abcSha256: checked.abcSha256, ...audio });
      setMediaError(null);
    } catch { setMediaError(t.mediaError); }
  }
  function exportCurrent() {
    if (!current || !checked) return;
    try { downloadMidi(checked.midi, checked.revision); setMediaError(null); } catch { setMediaError(t.mediaError); }
  }
  const error = checkError?.kind === 'headers' ? t.headers : checkError?.kind === 'native' ? t.nativeError : checkError?.kind === 'network' ? t.transportError
    : checkError?.kind === 'midi' ? checkError.detail === 'limit' ? t.limitMidi : checkError.detail === 'empty' ? t.emptyMidi : t.mediaError : t.renderFailed;
  const canSave = current && !save.isPending && !save.isError && !recoveryId.current && sourceReady;
  return <>{branchVersionId !== undefined ? <section className="surface branch-origin" aria-label={v.origin} data-branch-version-id={branchVersionId}>
    <h2>{v.origin}</h2>{branchVersionId && branch.isPending ? <Loading /> : branch.isError ? <ErrorNotice error={branch.error} onRetry={() => void branch.refetch()} /> : !branchReady ? <div className="error-box" role="alert"><strong>{v.originInvalid}</strong><button type="button" onClick={() => void branch.refetch()}>{v.reload}</button></div> : branch.data ? <><Link to="/projects/$projectId/versions/$versionId" params={{ projectId, versionId: branch.data.id }}>{branch.data.name}</Link><p className="hint">{v.originHelp}</p><div className="feature-actions"><VersionInputReuse version={branch.data} /></div></> : null}
    {!branchReady ? <p>{v.originRecovery}</p> : null}
  </section> : null}<div className="score-editor-heading"><h2>{t.title}</h2><p className="hint">{t.intro}</p></div><div className="workspace-grid score-editor">
    <section className="surface"><div className="section-heading"><h3>{t.draft}</h3><span className="tag" role="status">{t[status]}</span></div>
      <p className="hint">{t.help}</p><label className="visually-hidden" htmlFor="abc-draft">{t.label}</label><textarea id="abc-draft" aria-label={t.label} className="abc-editor" value={draft.abc} spellCheck={false} onChange={event => edit(event.target.value)} />
      <small>{t.revision} r{draft.revision} · {t.session}</small><div className="score-actions"><button type="button" onClick={() => setAttempt(value => value + 1)}>{t.validate}</button><button type="button" onClick={() => edit(initialABC)}>{t.restore}</button></div>
      {checkError ? <div className="error-box" role="alert"><strong>{error}</strong>{checkError.detail && checkError.kind !== 'midi' ? <pre className="abc-errors">{checkError.detail}</pre> : null}<p>{t.preserved}</p></div> : null}
      <p className="hint">{t.unsupported}</p>
    </section><section className="surface soft"><h3>{t.notation}</h3><section aria-label={t.preview} className="score-notation"><div ref={notation} role="img" aria-label={t.notation} /></section>
      <p role="status" className="hint">{current ? t.current : checked ? t.oldNotation : t.noNotation}</p><small>{checked ? `r${checked.revision}` : '—'}</small>
      <div className="score-actions"><button type="button" disabled={!current} onClick={audition}>{t.audition}</button><button type="button" disabled={!current} onClick={exportCurrent}>{t.export}</button></div><p className="hint">{t.tone}</p>
      {mediaError ? <p className="error-box" role="alert">{mediaError}</p> : null}
      <button className="primary" type="button" disabled={!canSave || ready} onClick={saveCurrent}>{save.isPending ? t.saving : score && draft.abc === initialABC ? t.selectSaved : t.save}</button>
      {score && versions.isError ? <ErrorNotice error={versions.error} onRetry={() => void versions.refetch()} /> : null}
      {save.isError ? <section className="error-box" role="alert"><strong>{t.saveUnknown}</strong><p>{t.saveRecovery}</p>{save.error instanceof ApiFailure && save.error.detail ? <small><code>{save.error.detail.code}</code>{save.error.detail.resource_id ? <> · <code>{save.error.detail.resource_id}</code></> : null}</small> : null}<button type="button" onClick={() => { if (save.variables) save.mutate(save.variables); }}>{t.saveRetry}</button></section> : null}
      {save.isSuccess ? <p role="status">{t.saved}</p> : null}
    </section></div><section className="surface selected-score" aria-label={t.selected} data-selected-score-id={draft.selected?.source_score_id}>
      <h3>{t.selected}</h3><p>{draft.selected ? ready ? t.ready : !selectionMatches ? v.originChanged : t.dirty : t.none}</p>{draft.selected ? <><p className="hint">{t.frozen}</p><small>r{draft.selected.revision} · {t.parent}: {draft.selected.parent_version_id ?? t.noParent}</small><details><summary>{t.selectedABC}</summary><pre className="score-code">{draft.selected.abc}</pre></details><Link className="button" to="/projects/$projectId/scores/$scoreId" params={{ projectId, scoreId: draft.selected.source_score_id }}>{t.openSaved}</Link></> : null}
    </section>{generation ?? <ScoreGeneration projectId={projectId} selectionReady={ready} />}</>;
}
