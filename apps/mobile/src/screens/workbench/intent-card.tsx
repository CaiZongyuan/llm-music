import { useMemo } from 'react';
import { router } from 'expo-router';
import { useMobileSession } from '@/data/provider';
import type { PendingIntent } from '@/data/session';
import { colors } from '@/constants/theme';
import { Action, Actions, Copy, Section } from './controls';
import { createWorkbenchActions } from './actions';
import { creatorMessage, useCreatorAction } from './use-creator-action';

export function IntentCard({ intent, onResolved }: { intent: PendingIntent; onResolved?(): void }) {
  const { session, state } = useMobileSession();
  const actions = useMemo(() => createWorkbenchActions(session), [session]);
  const action = useCreatorAction();
  const writeReady = state.connection === 'connected' && state.storage === 'ready' && state.foreground;
  const title = intent.operation === 'create_project' ? `新建项目 ·「${intent.body.name}」`
    : intent.operation === 'save_version' ? `保存版本 ·「${intent.body.name}」`
    : intent.operation === 'retry' ? '使用原任务输入重试' : '音乐生成请求';
  const execute = (operation: () => Promise<PendingIntent>) => { void action.run(operation).then(value => { if (value?.resourceId) onResolved?.(); }); };
  return <Section>
    <Copy style={{ color: intent.phase === 'rejected' ? colors.error : colors.accent }} testID={`intent-${intent.id}-phase`}>{title} · {intent.phase === 'prepared' ? '等待明确发送' : intent.phase === 'unknown' ? '结果待确认' : intent.phase === 'rejected' ? '已核对保存结果' : '已确认'}</Copy>
    <Copy kind="label">这次提交的输入已保留。继续时沿用原输入，不使用后来修改的草稿。</Copy>
    {intent.operation === 'generate' ? <><Copy kind="muted">{intent.body.style}</Copy><Copy kind="label" numberOfLines={3}>{intent.body.lyrics}</Copy></> : null}
    {intent.error ? <Copy kind="error">{creatorMessage(new Error(intent.error))}</Copy> : null}
    {action.error ? <Copy kind="error">{action.error}</Copy> : null}
    <Actions>
      {intent.phase === 'prepared' ? <Action label={action.busy ? '正在发送…' : '发送这次已保存的请求'} disabled={!writeReady || action.busy}
        testID={`send-intent-${intent.id}`} onPress={() => execute(() => actions.sendPrepared(intent.id))} /> : null}
      {intent.phase === 'unknown' ? <>
        <Action label={action.busy ? '正在核对…' : '先查询原请求'} testID={`recover-intent-${intent.id}`} disabled={action.busy || !state.foreground}
          onPress={() => execute(() => actions.recover(intent.id))} />
        <Action label={intent.operation === 'save_version' ? '再核对并继续这次保存' : '再核对并继续这次提交'} secondary testID={`replay-intent-${intent.id}`} disabled={action.busy || !writeReady}
          onPress={() => execute(() => actions.replay(intent.id))} />
      </> : null}
      {intent.operation === 'save_version' && intent.resourceId ? <Action label="查看已保存版本" secondary onPress={() => router.push({ pathname: '/workbench/versions/[projectId]/[versionId]',
        params: { projectId: intent.projectId, versionId: intent.resourceId! } })} /> : null}
    </Actions>
  </Section>;
}
