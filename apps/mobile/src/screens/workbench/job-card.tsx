import { useEffect, useMemo, useState } from 'react';
import type { JobRead } from '@llm-music/api-client';
import { View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { useMobileSession } from '@/data/provider';
import { Action, Actions, Copy } from './controls';
import { createWorkbenchActions } from './actions';
import { creatorMessage, useCreatorAction } from './use-creator-action';

const statuses: Record<JobRead['status'], string> = { queued: '等待开始', running: '正在处理', completed: '已完成', failed: '任务失败', cancelled: '已取消' };
const phases: Record<string, string> = { preparing: '准备任务', loading_model: '加载模型', planning_score: '准备音乐结构',
  generating_semantic: '生成旋律', synthesizing: '合成音频', decoding_audio: '还原音频', saving: '保存生成结果' };
export const terminalJob = (job: JobRead) => ['completed', 'failed', 'cancelled'].includes(job.status);

export function JobCard({ initial, knownJobs, onChanged, onObserved }: { initial: JobRead; knownJobs: readonly JobRead[]; onChanged(): void; onObserved(job: JobRead): void }) {
  const { session, state } = useMobileSession();
  const actions = useMemo(() => createWorkbenchActions(session), [session]);
  const action = useCreatorAction();
  const [observed, setObserved] = useState<JobRead | null>(null), [readError, setReadError] = useState('');
  const job = observed && (terminalJob(observed) && !terminalJob(initial) || Date.parse(observed.updated_at) >= Date.parse(initial.updated_at)) ? observed : initial;
  const pending = !terminalJob(job);
  const writeReady = state.connection === 'connected' && state.foreground && state.storage === 'ready';
  useEffect(() => {
    if (state.connection !== 'connected' || !state.foreground || !pending) return;
    return session.watchJob(initial.project_id, initial.id, {
      job: value => { setObserved(value); onObserved(value); setReadError(''); if (terminalJob(value)) onChanged(); },
      error: error => setReadError(creatorMessage(error)),
    });
  }, [session, state.server?.serverId, state.server?.deviceId, state.connection, state.foreground, initial.project_id, initial.id, pending, onChanged, onObserved]);
  const start = Date.parse(job.created_at), end = Date.parse(job.updated_at);
  const recordedSeconds = Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.floor((end - start) / 1000) : null;
  const inputs = job.inputs;
  const retryReady = job.operation === 'Generate' && ['failed', 'cancelled'].includes(job.status) && !job.recovery_required;
  const refresh = () => { void action.run(() => session.getJob(job.project_id, job.id)).then(value => { if (value) { setObserved(value); onObserved(value); } }); };
  return <View style={{ gap: spacing.small, paddingBottom: spacing.medium, borderBottomWidth: 1, borderBottomColor: colors.line }}>
    <Copy testID={`job-${job.id}-state`} style={{ color: job.status === 'failed' ? colors.error : colors.accent }}>
      {pending && job.cancel_requested ? '取消确认中' : statuses[job.status]}
    </Copy>
    <Copy kind="label">{new Date(job.created_at).toLocaleString('zh-CN')} · {job.operation}</Copy>
    <Copy kind="label" testID={`elapsed-${job.id}`}>{recordedSeconds === null ? '耗时尚未确认' : `已记录耗时 ${recordedSeconds} 秒`}{pending ? ' · 等待电脑更新' : ''}</Copy>
    {job.phase ? <Copy kind="label" testID={`phase-${job.id}`}>当前阶段 · {phases[job.phase] ?? job.phase}</Copy> : null}
    {typeof job.progress === 'number' ? <Copy kind="label">电脑报告进度 {Math.round(job.progress * 100)}%</Copy> : <Copy kind="label">整体进度尚未确认。</Copy>}
    <Copy kind="muted" numberOfLines={2}>{typeof inputs.style === 'string' ? inputs.style : '原输入已保留'}</Copy>
    <Copy kind="label">Seed {typeof inputs.seed === 'number' ? String(inputs.seed) : '—'} · {inputs.max_seconds === 0 ? '自动时长' : typeof inputs.max_seconds === 'number' ? `上限 ${inputs.max_seconds} 秒` : '时长信息未提供'} · 输入快照</Copy>
    {job.recovery_required ? <Copy kind="muted">电脑仍在核对原任务，确认前不能重试。</Copy> : null}
    {job.status === 'failed' ? <Copy kind="error">{typeof job.error?.message === 'string' ? job.error.message : '这次未得到可试听结果。原输入保留。'}</Copy> : null}
    {pending && job.cancel_requested ? <Copy kind="muted" testID={`cancel-pending-${job.id}`}>正在确认这次取消，先保留原任务。收到终态后再明确重试。</Copy> : null}
    {action.error || readError ? <Copy kind="error">{action.error || readError}</Copy> : null}
    <Actions>
      {pending && !job.cancel_requested && !job.recovery_required ? <Action label={action.busy ? '正在确认取消…' : '取消这次任务'} secondary
        testID={`cancel-${job.id}`} disabled={!writeReady || action.busy} onPress={() => {
          void action.run(() => actions.cancel(job)).then(value => { if (value) { setObserved(value); onObserved(value); onChanged(); } });
        }} /> : null}
      {retryReady ? <Action label="使用原输入创建新任务" secondary testID={`retry-${job.id}`} disabled={!writeReady || action.busy}
        onPress={() => { void action.run(() => actions.retry(job, knownJobs)).then(value => { if (value) onChanged(); }); }} /> : null}
      <Action label="重新读取原任务" secondary testID={`read-job-${job.id}`} disabled={state.connection !== 'connected' || action.busy} onPress={refresh} />
    </Actions>
  </View>;
}
