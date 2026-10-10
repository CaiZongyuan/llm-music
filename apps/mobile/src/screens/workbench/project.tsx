import { useCallback, useMemo, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { FlatList, Pressable, View } from 'react-native';
import type { components, JobRead } from '@llm-music/api-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/constants/theme';
import { useMobileSession } from '@/data/provider';
import { useCandidates, useJobs, useProject, useVersions } from '@/data/queries';
import { MobileFailure, type CreationDraft } from '@/data/session';
import { createWorkbenchActions, generationBlocked, pendingJobRecords } from './actions';
import { Action, Actions, Copy, Field, Section } from './controls';
import { ConnectionState } from './connection-state';
import { ReadStatus } from './read-status';
import { IntentCard } from './intent-card';
import { JobCard, terminalJob } from './job-card';
import { CandidateCard } from './candidate-card';
import { creatorMessage, useCreatorAction } from './use-creator-action';
import { useCreatorIntents } from './use-creator-intents';

const example = { style: '独立流行，温暖女声，慢速鼓点，夜晚的城市感', lyrics: '[Verse]\n末班车穿过雨后的街\n霓虹在车窗慢慢重叠\n[Chorus]\n让这一刻停在声间\n把没说的话唱成明天', seed: '42', maxSeconds: '0' };

export function ProjectWorkbenchScreen() {
  const params = useLocalSearchParams<{ projectId: string }>();
  const projectId = typeof params.projectId === 'string' ? params.projectId : '';
  const query = useProject(projectId), { state } = useMobileSession();
  return <>
    <Stack.Screen options={{ title: query.data?.name ?? '声间 · 项目' }} />
    {query.data ? <ProjectScene key={`${state.server?.serverId}:${projectId}`} project={query.data} /> : <View style={{ padding: spacing.medium, gap: spacing.large }}>
      <ConnectionState /><ReadStatus data={query.data} fetching={query.isFetching} error={query.error} label="项目"
        onRetry={() => { void query.refetch(); }} />
      <Actions><Action label="返回我的项目" secondary onPress={() => router.navigate('/workbench')} /></Actions>
    </View>}
  </>;
}

function ProjectScene({ project }: { project: components['schemas']['ProjectRead'] }) {
  const { session, state } = useMobileSession(), insets = useSafeAreaInsets();
  const jobs = useJobs(project.id), candidates = useCandidates(project.id), versions = useVersions(project.id);
  const actions = useMemo(() => createWorkbenchActions(session), [session]);
  const action = useCreatorAction(), [draftError, setDraftError] = useState(''), [replacement, setReplacement] = useState(0), [tab, setTab] = useState<'create' | 'versions'>('create');
  const [directJobs, setDirectJobs] = useState<Record<string, JobRead>>({});
  const projectIntents = useCreatorIntents(project.id);
  const intents = projectIntents.filter(intent => ['generate', 'retry'].includes(intent.operation) && ['prepared', 'unknown'].includes(intent.phase));
  const visibleJobs = [...(jobs.data ?? [])];
  for (const observed of Object.values(directJobs)) {
    const index = visibleJobs.findIndex(job => job.id === observed.id);
    if (index < 0) visibleJobs.push(observed);
    else if (terminalJob(observed) && !terminalJob(visibleJobs[index]!) || Date.parse(observed.updated_at) >= Date.parse(visibleJobs[index]!.updated_at)) visibleJobs[index] = observed;
  }
  const knownJobs = jobs.data === undefined ? undefined : visibleJobs;
  const active = visibleJobs.some(job => !terminalJob(job));
  const awaitingJobs = pendingJobRecords(projectIntents, visibleJobs);
  const blocked = generationBlocked(projectIntents, knownJobs);
  const knownVersionIds = new Set(projectIntents.filter(intent => intent.operation === 'save_version' && intent.resourceId).map(intent => intent.resourceId!));
  const awaitingVersions = [...knownVersionIds].filter(id => !versions.data?.some(version => version.id === id));
  const pendingSaves = projectIntents.filter(intent => intent.operation === 'save_version' && ['prepared', 'unknown'].includes(intent.phase));
  const versionCount = awaitingVersions.length ? '待读取' : pendingSaves.length ? '待确认' : versions.data?.length ?? '—';
  const writeReady = state.connection === 'connected' && state.foreground && state.storage === 'ready';
  const refresh = useCallback(() => { void jobs.refetch(); void candidates.refetch(); void versions.refetch(); }, [jobs.refetch, candidates.refetch, versions.refetch]);
  const observedJob = useCallback((job: JobRead) => { setDirectJobs(current => ({ ...current, [job.id]: job })); }, []);
  let draft: CreationDraft;
  try { draft = session.getDraft(project.id); }
  catch (problem) {
    if (!(problem instanceof MobileFailure) || problem.code !== 'draft_unavailable') throw problem;
    return <View style={{ padding: spacing.medium, gap: spacing.medium }}><ConnectionState />
      <Copy kind="muted">正在切换电脑，当前项目的输入稍后恢复。</Copy>
      <Actions><Action label="返回我的项目" secondary onPress={() => router.navigate('/workbench')} /></Actions>
    </View>;
  }
  const patch = (field: keyof CreationDraft) => (value: string) => { void session.updateDraft(project.id, { [field]: value }).catch(problem => setDraftError(creatorMessage(problem))); };
  return <FlatList contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
    data={tab === 'create' ? visibleJobs.slice().reverse() : []} keyExtractor={job => job.id}
    contentContainerStyle={{ maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center', padding: spacing.medium,
      paddingBottom: insets.bottom + spacing.large, gap: spacing.large }}
    ListHeaderComponent={<View style={{ gap: spacing.large }}>
      <Copy kind="label" style={{ color: colors.accent }}>声间 / {project.name}</Copy>
      {project.description ? <Copy kind="muted">{project.description}</Copy> : null}
      <ConnectionState />
      <Actions><Action label="返回我的项目" secondary onPress={() => router.navigate('/workbench')} /></Actions>
      <View style={{ flexDirection: 'row', gap: spacing.medium }}>
        {(['create', 'versions'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: tab === value }}
          testID={`tab-${value}`} onPress={() => setTab(value)} style={{ padding: spacing.small, borderBottomWidth: 2, borderBottomColor: tab === value ? colors.accent : colors.line }}>
          <Copy style={{ color: tab === value ? colors.accent : colors.muted }}>{value === 'create' ? '创作' : `版本 · ${versionCount}`}</Copy>
        </Pressable>)}
      </View>
      {tab === 'create' ? <>
        <Copy kind="heading">这次想唱什么？</Copy><Copy kind="label">草稿会保留。修改草稿不会改变已经提交的任务。</Copy>
        <Field label="音乐风格" initialValue={draft.style} replacement={replacement} onChangeText={patch('style')} testID="draft-style" multiline numberOfLines={2} maxLength={1024} placeholder="流派、声音、乐器、情绪…" />
        <Field label="歌词" initialValue={draft.lyrics} replacement={replacement} onChangeText={patch('lyrics')} testID="draft-lyrics" multiline numberOfLines={6} maxLength={10000} placeholder="把想说的话写成几行歌词" />
        <Field label="Seed" initialValue={draft.seed} replacement={replacement} onChangeText={patch('seed')} testID="draft-seed" keyboardType="number-pad" hint="请输入非负安全整数。改变 Seed，探索另一种演绎。" />
        <Field label="时长上限（秒）" initialValue={draft.maxSeconds} replacement={replacement} onChangeText={patch('maxSeconds')} testID="draft-duration" keyboardType="number-pad" hint="留空或 0 = 自动。手动设置 5–360 秒，不承诺精确时长。" />
        {draftError || action.error ? <Copy kind="error" testID="draft-error">{action.error || (state.storage === 'error' ? draftError : '')}</Copy> : null}
        <Actions>
          <Action label={action.busy ? '正在提交…' : intents.length ? '先查询原请求' : active ? '任务正在进行' : '开始生成'} testID="generate-submit"
            disabled={!writeReady || action.busy || blocked}
            onPress={() => { void action.run(() => actions.generate(project.id, knownJobs)).then(value => { if (value) refresh(); }); }} />
          <Action label="填入一段示例" secondary testID="fill-example" onPress={() => {
            void session.updateDraft(project.id, example).catch(problem => setDraftError(creatorMessage(problem)));
            setReplacement(value => value + 1); action.clearError();
          }} />
        </Actions>
        {intents.map(intent => <IntentCard key={intent.id} intent={intent} onResolved={refresh} />)}
        {awaitingJobs.map(intent => <Section key={intent.id}>
          <Copy style={{ color: colors.accent }}>任务已创建，最新状态仍待读取。</Copy>
          <Copy kind="label">保留这次任务，读取后再决定下一步。</Copy>
          <Actions><Action label="读取刚创建的原任务" testID={`read-accepted-job-${intent.resourceId}`} disabled={!writeReady || action.busy}
            onPress={() => { void action.run(() => session.getJob(project.id, intent.resourceId!)).then(value => { if (value) observedJob(value); }); }} /></Actions>
        </Section>)}
        <Section title="任务"><ReadStatus data={jobs.data} fetching={jobs.isFetching} error={jobs.error} empty={jobs.data?.length === 0 && visibleJobs.length === 0 && awaitingJobs.length === 0}
          label="任务" onRetry={() => { void jobs.refetch(); }} /></Section>
      </> : <Section title="已保存版本">
        <ReadStatus data={versions.data} fetching={versions.isFetching} error={versions.error} empty={versions.data?.length === 0 && awaitingVersions.length === 0 && pendingSaves.length === 0}
          label="版本" onRetry={() => { void versions.refetch(); }} />
        {versions.data?.slice().reverse().map(version => <View key={version.id} style={{ gap: spacing.small, paddingBottom: spacing.medium, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Copy kind="heading">{version.name}</Copy><Copy kind="label">{new Date(version.created_at).toLocaleDateString('zh-CN')} 保存 · Seed {String(version.inputs.seed)}</Copy>
          <Copy kind="muted">{version.inputs.style}</Copy>
          <Actions><Action label="查看输入与试听" testID={`open-version-${version.id}`} secondary onPress={() => router.push({ pathname: '/workbench/versions/[projectId]/[versionId]', params: { projectId: project.id, versionId: version.id } })} /></Actions>
        </View>)}
        {awaitingVersions.length ? <><Copy kind="muted">已有版本已保存，列表尚待读取核对。</Copy>
          <Actions>{awaitingVersions.map(id => <Action key={id} label="读取已保存版本" testID={`read-accepted-version-${id}`} secondary
            onPress={() => router.push({ pathname: '/workbench/versions/[projectId]/[versionId]', params: { projectId: project.id, versionId: id } })} />)}</Actions>
        </> : null}
        {pendingSaves.map(intent => <IntentCard key={intent.id} intent={intent} onResolved={refresh} />)}
      </Section>}
    </View>}
    renderItem={({ item }) => <JobCard initial={item} knownJobs={visibleJobs} onChanged={refresh} onObserved={observedJob} />}
    ListFooterComponent={tab === 'create' ? <Section title="候选结果">
      <ReadStatus data={candidates.data} fetching={candidates.isFetching} error={candidates.error} empty={candidates.data?.length === 0}
        label="候选结果" onRetry={() => { void candidates.refetch(); }} />
      <ReadStatus data={versions.data} fetching={versions.isFetching} error={versions.error} label="保存记录" onRetry={() => { void versions.refetch(); }} />
      {candidates.data?.slice().reverse().map(candidate => <CandidateCard key={candidate.id} candidate={candidate}
        versions={versions.data} versionsError={!!versions.error} onChanged={refresh} />)}
    </Section> : null} />;
}
