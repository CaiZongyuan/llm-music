import { useMemo } from 'react';
import type { components } from '@llm-music/api-client';
import { router } from 'expo-router';
import { useMobileSession } from '@/data/provider';
import { useVersion } from '@/data/queries';
import { colors } from '@/constants/theme';
import { Action, Actions, Copy, Field, Section } from './controls';
import { createWorkbenchActions } from './actions';
import { IntentCard } from './intent-card';
import { PlayerPanel } from './player-panel';
import { useTitleDraft } from './title-draft';
import { useCreatorAction } from './use-creator-action';
import { ReadStatus } from './read-status';
import { useCreatorIntents } from './use-creator-intents';

type Candidate = components['schemas']['CandidateRead'];
type Version = components['schemas']['VersionRead'];

export function CandidateCard({ candidate, versions, versionsError, onChanged }: { candidate: Candidate; versions: readonly Version[] | undefined; versionsError: boolean; onChanged(): void }) {
  const { session, state } = useMobileSession();
  const actions = useMemo(() => createWorkbenchActions(session), [session]);
  const title = useTitleDraft('version', candidate.project_id, candidate.id), action = useCreatorAction();
  const intent = useCreatorIntents(candidate.project_id).find(item => item.operation === 'save_version' && item.body.candidate_id === candidate.id &&
    (['prepared', 'unknown'].includes(item.phase) || !!item.resourceId));
  const indexed = versions?.find(version => version.candidate_id === candidate.id);
  const lookup = useVersion(!indexed && intent?.resourceId ? candidate.project_id : '', !indexed ? intent?.resourceId ?? '' : '');
  const saved = indexed ?? lookup.data;
  const saveKnown = versions !== undefined;
  const frozenName = intent?.operation === 'save_version' ? intent.body.name : title.value;
  return <Section>
    <Copy kind="heading">候选结果</Copy><Copy kind="label">{saved ? '已保存为版本' : intent?.resourceId ? '已保存，名称待读取核对' : intent?.phase === 'unknown' ? '保存结果待确认' : intent?.phase === 'prepared' ? '保存请求已保留' : !saveKnown ? '保存记录尚未确认' : versionsError ? '上次读取尚未保存，记录暂未更新' : '尚未保存为版本'} · {new Date(candidate.created_at).toLocaleString('zh-CN')}</Copy>
    {intent?.resourceId && !indexed ? <ReadStatus data={lookup.data} fetching={lookup.isFetching} error={lookup.error} label="这个版本" onRetry={() => { void lookup.refetch(); }} /> : null}
    <PlayerPanel selection={{ projectId: candidate.project_id, assetId: candidate.audio_asset_id, recordId: candidate.id, label: '本次候选结果' }} />
    {saved ? <>
      <Copy testID={`saved-${candidate.id}`} style={{ color: colors.accent }}>已明确保存为「{saved.name}」</Copy>
      <Actions><Action label="查看这个版本" secondary onPress={() => router.push({ pathname: '/workbench/versions/[projectId]/[versionId]', params: { projectId: candidate.project_id, versionId: saved.id } })} /></Actions>
    </> : <>
      <Field key={title.key} replacement={intent?.id ?? 'editing'} label="版本名称" initialValue={frozenName} onChangeText={title.set} maxLength={200}
        testID={`version-name-${candidate.id}`} readOnly={!!intent} placeholder="例如：雨后 · 更轻的鼓点" hint={intent ? '这次保存名称已冻结，先核对原保存。' : '喜欢这次结果，再明确命名保存。'} />
      {action.error ? <Copy kind="error" testID={`save-error-${candidate.id}`}>{action.error}</Copy> : null}
      {title.error ? <Copy kind="error">{title.error}</Copy> : null}
      {intent ? <IntentCard intent={intent} onResolved={onChanged} /> : <Actions>
        <Action label={action.busy ? '正在保存…' : !saveKnown ? '先读取保存记录' : '明确保存为版本'} testID={`save-${candidate.id}`} disabled={!saveKnown || action.busy || state.connection !== 'connected' || state.storage !== 'ready' || !state.foreground}
          onPress={() => { void action.run(() => actions.saveVersion(candidate, title.value, versions)).then(value => { if (value) onChanged(); }); }} />
      </Actions>}
    </>}
  </Section>;
}
