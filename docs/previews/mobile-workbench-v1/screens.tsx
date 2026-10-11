import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Action, Actions, colors, Copy, Field, Flag, layout, Page, PreviewNotice, Section, spacing, useControlWidth } from './controls';
import { jobPending, sampleDraft, usePreview, validateDraft, validateName, type Job } from './model';
import { SeekControl } from './seek-control';

const connectionLabels = { unpaired: '还未连接电脑', connected: '演示电脑已连接', disconnected: '与电脑的连接已中断', revoked: '设备配对已被撤销' };
const jobLabels = { queued: '排队中', running: '生成中', completed: '可以试听了', failed: '生成失败', cancelled: '已取消' };
const stageLabels = ['准备音乐', '生成旋律与人声', '整理音频'];

function ConnectionNotice({ showPairAction = true }: { showPairAction?: boolean }) {
  const model = usePreview();
  return <View style={{ gap: spacing.small }}>
    <Copy testID="connection-status" style={{ color: model.connection === 'connected' ? colors.accent : colors.muted }}>{connectionLabels[model.connection]}</Copy>
    {model.connection === 'disconnected' ? <>
      <Copy kind="muted">草稿已保留。恢复连接会查询原任务，不会再次生成。</Copy>
      <Actions><Action label={model.recovering ? '正在查询原任务…' : '恢复连接并查询'} disabled={model.recovering} testID="recover-connection" onPress={() => { void model.recover(); }} /></Actions>
    </> : null}
    {showPairAction && (model.connection === 'revoked' || model.connection === 'unpaired') ? <Actions>
      <Action label="连接我的电脑" testID="connect-computer" onPress={() => router.push('/preview/connect')} />
    </Actions> : null}
  </View>;
}

function ToolsLink() {
  return <Actions><Action label="预览工具" testID="open-preview-tools" secondary onPress={() => router.push('/preview/tools')} /></Actions>;
}

export function ProjectsScreen() {
  const model = usePreview();
  const insets = useSafeAreaInsets();
  const visibleProjects = model.connection === 'connected' && model.catalogState === 'ready' ? model.projects : [];
  return <>
    <Stack.Screen options={{ title: '声间 · 我的项目' }} />
    <FlatList data={visibleProjects} keyExtractor={project => project.id} contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled" contentContainerStyle={{
        maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center', padding: spacing.medium,
        paddingBottom: insets.bottom + spacing.large, gap: spacing.medium,
      }} ListHeaderComponent={<View style={{ gap: spacing.large, paddingBottom: spacing.small }}>
        <PreviewNotice /><ConnectionNotice />
        {model.connection === 'connected' ? <>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.small }}>
            <Copy kind="heading">我的项目</Copy><Copy kind="label">{model.catalogState === 'empty' ? 0 : model.projects.length} 个项目</Copy>
          </View>
          <Actions><Action label="新建项目" testID="new-project" onPress={() => router.push('/preview/new')} /></Actions>
        </> : null}
      </View>}
      renderItem={({ item }) => <Pressable testID={`project-${item.id}`} accessibilityRole="button"
        accessibilityLabel={`打开项目 ${item.name}`} onPress={() => router.push({ pathname: '/preview/project', params: { id: item.id } })}
        style={({ pressed }) => ({ paddingVertical: spacing.medium, paddingHorizontal: spacing.medium,
          backgroundColor: pressed ? colors.line : colors.panel, gap: spacing.small,
          borderLeftColor: colors.accent, borderLeftWidth: 2 })}>
        <Copy kind="heading">{item.name}</Copy><Copy kind="muted">{item.description}</Copy>
        <Copy kind="label">{item.versions.length} 个已保存版本 · {model.jobs.filter(job => job.projectId === item.id && jobPending(job)).length} 个进行中任务</Copy>
      </Pressable>}
      ListEmptyComponent={<View style={{ gap: spacing.medium, paddingVertical: spacing.large }}>
        {model.catalogState === 'loading' ? <><ActivityIndicator color={colors.accent} /><Copy testID="projects-loading">正在读取项目…</Copy></> :
          model.connection !== 'connected' ? <><Copy kind="heading">让灵感离电脑近一点</Copy><Copy kind="muted">连接后，你可以在手机上创作、试听，并把喜欢的结果保存成版本。</Copy></> :
          model.catalogState === 'error' ? <><Copy kind="error" testID="projects-error">项目暂时无法读取</Copy><Copy kind="muted">已有草稿仍在。可以重新读取，或检查电脑连接。</Copy><Actions><Action label="重新读取项目" testID="retry-projects" onPress={() => { void model.recover(); }} /></Actions></> :
          <><Copy kind="heading" testID="projects-empty">还没有项目</Copy><Copy kind="muted">新建一个项目，把第一段旋律留在这里。</Copy></>}
      </View>}
      ListFooterComponent={<View style={{ gap: spacing.medium, paddingTop: spacing.large }}>
        {model.connection === 'connected' ? <Actions><Action label="电脑连接与设置" secondary onPress={() => router.push('/preview/connect')} /></Actions> : null}
        <ToolsLink />
      </View>} />
  </>;
}

export function ConnectScreen() {
  const model = usePreview();
  return <><Stack.Screen options={{ title: '连接电脑' }} /><Page>
    <PreviewNotice /><ConnectionNotice showPairAction={false} />
    <Copy kind="muted">电脑保持运行，手机与电脑连接同一 Wi-Fi。输入电脑显示的地址和短时配对码。</Copy>
    <Field label="电脑地址" testID="pair-address" initialValue={model.address} onChangeText={model.setAddress} keyboardType="url" autoCapitalize="none" placeholder="http://192.168.31.209:8000" />
    <Field label="配对码" testID="pair-code" initialValue={model.pairCode} onChangeText={model.setPairCode} keyboardType="number-pad" placeholder="6 位配对码" hint="本预览的演示码：246810。不会访问这个地址。" />
    {model.pairStatus === 'error' ? <Copy kind="error" testID="pair-error">{model.pairError}</Copy> : null}
    {model.pairStatus === 'loading' ? <ActivityIndicator color={colors.accent} /> : null}
    <Actions><Action label={model.pairStatus === 'loading' ? '正在连接…' : model.connection === 'connected' ? '重新连接' : '确认配对'}
      testID="pair-submit" disabled={model.pairStatus === 'loading'} onPress={() => { void model.pair().then(success => { if (success) router.replace('/preview'); }); }} /></Actions>
    {model.connection !== 'unpaired' && model.connection !== 'revoked' ? <Section title="已配对设备">
      <Copy>我的手机 · 演示设备</Copy><Copy kind="label">配对凭据只保留在本次预览内。正式版可在电脑上撤销设备访问。</Copy>
      <Actions><Action label="模拟电脑撤销配对" secondary testID="revoke-pairing" onPress={() => model.setConnection('revoked')} /></Actions>
    </Section> : null}
  </Page></>;
}

export function NewProjectScreen() {
  const model = usePreview();
  const [error, setError] = useState('');
  return <><Stack.Screen options={{ title: '新建项目' }} /><Page>
    <PreviewNotice /><Copy kind="muted">一首歌、一次实验，都可以从一个项目开始。</Copy>
    <Field label="项目名称" testID="project-name" initialValue={model.newProjectName} onChangeText={model.setNewProjectName} placeholder="例如：凌晨两点的海" maxLength={200} hint="最多 200 个字。" />
    {error ? <Copy kind="error">{error}</Copy> : null}
    <Actions><Action label="创建并开始创作" testID="create-project" disabled={model.connection !== 'connected'} onPress={() => {
      const problem = validateName(model.newProjectName, '项目');
      if (problem) { setError(problem); return; }
      const id = model.addProject();
      if (!id) { setError('恢复电脑连接后再创建项目，名称已保留。'); return; }
      router.replace({ pathname: '/preview/project', params: { id } });
    }} /></Actions>
    {model.connection !== 'connected' ? <ConnectionNotice /> : null}
    <Copy kind="label">返回不会丢掉已输入的名称。</Copy>
  </Page></>;
}

export function ProjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const model = usePreview();
  const [tab, setTab] = useState<'create' | 'versions'>('create');
  const [error, setError] = useState('');
  const project = model.projects.find(item => item.id === id);
  if (!project) return <Page><Copy kind="heading">找不到这个项目</Copy><Actions><Action label="返回项目列表" onPress={() => router.replace('/preview')} /></Actions></Page>;
  const jobs = model.jobs.filter(job => job.projectId === project.id);
  const activeJob = jobs.find(jobPending);
  const patch = (field: 'style' | 'lyrics' | 'seed' | 'maxSeconds') => (value: string) => model.updateDraft(project.id, { [field]: value });
  return <><Stack.Screen options={{ title: project.name }} /><Page>
    <PreviewNotice /><ConnectionNotice />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small }}>
      {(['create', 'versions'] as const).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} testID={`tab-${item}`}
        onPress={() => setTab(item)} style={{ paddingHorizontal: spacing.medium, paddingVertical: spacing.small,
          borderBottomWidth: 2, borderBottomColor: tab === item ? colors.accent : colors.line }}>
        <Copy style={{ color: tab === item ? colors.accent : colors.muted }}>{item === 'create' ? '创作' : `版本 · ${project.versions.length}`}</Copy>
      </Pressable>)}
    </View>
    {tab === 'create' ? <>
      <View style={{ gap: spacing.small }}><Copy kind="heading">这次想唱什么？</Copy><Copy kind="label">草稿会保留。修改草稿不会改变已经提交的任务。</Copy></View>
      <Field key={`style-${project.draft.revision}`} label="音乐风格" initialValue={project.draft.style} onChangeText={patch('style')} testID="draft-style" multiline numberOfLines={2} placeholder="流派、声音、乐器、情绪…" maxLength={1024} />
      <Field key={`lyrics-${project.draft.revision}`} label="歌词" initialValue={project.draft.lyrics} onChangeText={patch('lyrics')} testID="draft-lyrics" multiline numberOfLines={6} placeholder="把想说的话写成几行歌词" maxLength={10000} />
      <Field key={`seed-${project.draft.revision}`} label="Seed" initialValue={project.draft.seed} onChangeText={patch('seed')} testID="draft-seed" keyboardType="number-pad" hint="相同输入与 Seed 方便比较；改变 Seed，探索另一种演绎。" />
      <Field key={`duration-${project.draft.revision}`} label="时长上限（秒）" initialValue={project.draft.maxSeconds} onChangeText={patch('maxSeconds')} testID="draft-duration" keyboardType="number-pad" hint="留空或 0 = 随歌词自动决定。手动设置 5–360 秒。" />
      {error ? <Copy kind="error" testID="draft-error">{error}</Copy> : null}
      <Actions>
        <Action label={activeJob?.unknown ? '先查询原任务' : activeJob?.cancelRequestedAt ? '取消确认中' : activeJob ? '任务正在进行' : '开始生成'} testID="generate-submit"
          disabled={!!activeJob || model.connection !== 'connected'} onPress={() => {
            const problem = validateDraft(project.draft); setError(problem || '');
            if (!problem) model.submit(project.id);
          }} />
        <Action label="填入一段示例" secondary testID="fill-example" onPress={() => {
          model.updateDraft(project.id, { ...sampleDraft, revision: project.draft.revision + 1 }); setError('');
        }} />
      </Actions>
      {activeJob?.unknown ? <Copy kind="muted" testID="unknown-submit">提交结果待确认。恢复连接后先查询这次请求，不自动重发。</Copy> : null}
      <Section title="任务与候选结果">
        {jobs.length === 0 ? <Copy kind="muted">还没有生成任务。准备好输入后，开始第一段音乐。</Copy> : jobs.map(job => <JobCard key={job.id} job={job} />)}
      </Section>
    </> : <Section title="已保存版本">
      {project.versions.length === 0 ? <><Copy kind="muted" testID="versions-empty">还没有保存的版本。</Copy><Copy kind="label">生成完成后先试听，喜欢再明确保存。候选结果不会自动成为版本。</Copy></> :
        project.versions.map(version => <View key={version.id} style={{ gap: spacing.medium, paddingBottom: spacing.large, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <Copy kind="heading" testID={`version-${version.id}`}>{version.name}</Copy><Copy kind="label">{new Date(version.savedAt).toLocaleDateString('zh-CN')} 保存 · Seed {version.input.seed}</Copy>
          <Copy>{version.input.style}</Copy><Copy kind="muted">{version.input.lyrics}</Copy>
          <Copy kind="label">版本保留当时的输入。演示试听使用同一段本地样例。</Copy>
          <PlayerPanel recordKey={version.id} />
        </View>)}
    </Section>}
    <ToolsLink />
  </Page></>;
}

function JobCard({ job }: { job: Job }) {
  const model = usePreview();
  const project = model.projects.find(item => item.id === job.projectId)!;
  const name = model.candidateNames[job.id] || '';
  const [saveError, setSaveError] = useState('');
  const saveIntent = model.saveIntents[job.id];
  const saving = saveIntent?.status === 'pending';
  const saved = project.versions.find(version => version.jobId === job.id);
  const offline = model.connection !== 'connected';
  const elapsed = Math.max(0, Math.floor(((job.endedAt ?? model.clock) - job.createdAt) / 1000));
  return <View style={{ gap: spacing.medium, paddingBottom: spacing.large, borderBottomWidth: 1, borderBottomColor: colors.line }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.small }}>
      <Copy testID={`job-${job.id}-state`} style={{ color: job.state === 'failed' ? colors.error : colors.accent, fontWeight: '600' }}>{job.unknown ? '提交结果待确认' : job.cancelRequestedAt ? '取消确认中' : offline ? '等待连接恢复' : jobLabels[job.state]}</Copy>
      <Copy kind="label">任务 {job.id.replace('job-', '')} · Seed {job.input.seed}</Copy>
    </View>
    <Copy kind="label">{job.input.maxSeconds === '0' ? '自动时长' : `上限 ${job.input.maxSeconds} 秒`} · 输入快照已保留</Copy>
    <Copy testID={`elapsed-${job.id}`} kind="label" style={{ fontVariant: ['tabular-nums'] }}>{job.endedAt ? '总耗时' : '已等待'} {elapsed} 秒</Copy>
    {(job.unknown || job.cancelUnconfirmed) && !offline ? <Actions>
      <Action label={model.recovering ? '正在查询原任务…' : '查询原任务状态'} testID={`query-${job.id}`} disabled={model.recovering}
        onPress={() => { void model.recover(); }} />
    </Actions> : null}
    {job.unknown || offline ? <Copy kind="muted">{job.cancelRequestedAt ? '取消请求已发出，结果仍待确认。恢复连接后读取原任务，确认终态前不能重新生成。' : '恢复后读取原任务的最新状态。电脑端的演示任务仍在继续。'}</Copy> : <>
      {job.cancelRequestedAt ? <>
        <ActivityIndicator color={colors.accent} />
        <Copy testID={`cancel-pending-${job.id}`}>正在确认这次取消，先保留原任务。</Copy>
        <Copy kind="label">收到取消终态后，才可以明确创建新任务。</Copy>
      </> : null}
      {!job.cancelRequestedAt && (job.state === 'queued' || job.state === 'running') ? <>
        <Copy kind="label">{job.state === 'queued' ? '等待电脑开始处理' : '当前阶段 · ' + stageLabels[job.stage]}</Copy>
        {job.state === 'running' ? stageLabels.map((stage, index) => <Copy kind="label" key={stage} style={{ color: index === job.stage ? colors.accent : colors.muted }}>{index < job.stage ? '已完成' : index === job.stage ? '进行中' : '待开始'} · {stage}</Copy>) : null}
        <Actions><Action label="取消这次任务" testID={`cancel-${job.id}`} secondary onPress={() => model.cancel(job.id)} /></Actions>
      </> : null}
      {!job.cancelRequestedAt && (job.state === 'failed' || job.state === 'cancelled') ? <>
        <Copy kind={job.state === 'failed' ? 'error' : 'muted'}>{job.state === 'failed' ? '这次没有得到可试听的结果，原输入已保留。' : '已停止这次任务，草稿不受影响。'}</Copy>
        <Actions><Action label="使用原输入创建新任务" secondary testID={`retry-${job.id}`} disabled={model.jobs.some(item => item.projectId === job.projectId && jobPending(item))}
          onPress={() => { model.submit(project.id, job.input); }} /></Actions>
        <Copy kind="label">这是明确的新请求，原任务与当前草稿都会保留。</Copy>
      </> : null}
      {job.state === 'completed' ? <>
        <Copy kind="heading">候选结果</Copy><Copy kind="label">{saved ? '已保存为版本' : '尚未保存为版本'} · 本地样例试听</Copy>
        <PlayerPanel recordKey={job.id} />
        {saved ? <Copy testID={`saved-${job.id}`} style={{ color: colors.accent }}>已明确保存为「{saved.name}」</Copy> : <>
          <Field label="版本名称" initialValue={name} onChangeText={value => model.setCandidateName(job.id, value)} testID={`version-name-${job.id}`} placeholder="例如：雨后 · 更轻的鼓点" maxLength={200} readOnly={!!saveIntent} hint={saveIntent ? '这次保存的名称已冻结，核对结果后再继续。' : '最多 200 个字。'} />
          {saveError ? <Copy kind="error" testID="save-error">{saveError}</Copy> : null}
          {saveIntent && saveIntent.status !== 'pending' ? <>
            <Copy testID={`save-unknown-${job.id}`} style={{ color: colors.accent }}>保存结果待确认 ·「{saveIntent.name}」</Copy>
            <Copy kind="muted">电脑可能已经保存成功。先读取这个候选结果的已保存版本，不改名或重复写入。</Copy>
            <Actions><Action label={saveIntent.status === 'checking' ? '正在核对原保存…' : '读取已保存版本并核对'} testID={`check-save-${job.id}`}
              disabled={saveIntent.status === 'checking'} onPress={() => {
                setSaveError(''); void model.checkSavedVersion(job.id).then(problem => setSaveError(problem || ''));
              }} /></Actions>
          </> : <Actions><Action label={saving ? '正在保存…' : '明确保存为版本'} testID={`save-${job.id}`} disabled={saving} onPress={() => {
            setSaveError(''); void model.saveVersion(job, name).then(problem => setSaveError(problem || ''));
          }} /></Actions>}
        </>}
      </> : null}
    </>}
  </View>;
}

function PlayerPanel({ recordKey }: { recordKey: string }) {
  const model = usePreview();
  const width = useControlWidth();
  const current = model.playbackKey === recordKey;
  const playing = current && model.audioStatus.playing;
  const position = current ? model.audioStatus.currentTime : 0;
  const duration = model.audioStatus.duration;
  const loaded = model.audioStatus.isLoaded && duration > 0;
  const ready = loaded && model.connection === 'connected';
  const time = (value: number) => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
  return <View style={{ gap: spacing.small }}>
    <Copy kind="label">试听样例 · Morning Song（历史生成音频）</Copy>
    <Copy testID={`playback-${recordKey}`} style={{ color: colors.accent, fontVariant: ['tabular-nums'] }}>
      {playing ? '播放中' : '已暂停'} · {time(position)} / {time(duration)}
    </Copy>
    {!loaded ? <Copy kind="label">正在准备本地音频…</Copy> : null}
    {model.connection !== 'connected' ? <Copy kind="label">试听已暂停，连接电脑后再继续。播放位置已保留。</Copy> : null}
    <SeekControl controlWidth={width} testID={`seek-${recordKey}`} value={position} min={0} max={Math.max(1, duration)} disabled={!ready}
      onValueChange={seconds => { void model.seekSample(recordKey, seconds); }} />
    <Actions>
      <Action label={playing ? '暂停试听' : '播放试听'} testID={`play-${recordKey}`} disabled={!ready}
        onPress={() => { void model.toggleSample(recordKey); }} />
      <Action label="向后跳 10 秒" testID={`seek-forward-${recordKey}`} secondary disabled={!ready}
        onPress={() => { void model.seekSample(recordKey, Math.min(duration, position + 10)); }} />
      <Action label="从头试听" testID={`seek-start-${recordKey}`} secondary disabled={!ready}
        onPress={() => { void model.seekSample(recordKey, 0); }} />
    </Actions>
    {model.audioError || model.audioStatus.error ? <Copy kind="error">{model.audioError || '本地样例暂时无法播放，请重新打开预览。'}</Copy> : null}
    <Copy kind="label">这是已有样例，不代表本次输入实际生成的声音。</Copy>
  </View>;
}

export function ToolsScreen() {
  const model = usePreview();
  return <><Stack.Screen options={{ title: '预览工具' }} /><Page>
    <PreviewNotice /><Copy kind="muted">控制下一次演示的结果。只影响本地预览，不会写入任何创作数据。</Copy>
    <Section title="下一次操作">
      <Flag label="下一次配对失败" testID="toggle-pair-failure" value={model.nextPairFailure} onValueChange={model.setNextPairFailure} />
      <Flag label="下一次生成失败" testID="toggle-job-failure" value={model.nextFailure} onValueChange={model.setNextFailure} />
      <Flag label="下一次提交结果未知" testID="toggle-unknown-submit" value={model.nextUnknown} onValueChange={model.setNextUnknown} />
      <Flag label="下一次保存失败" testID="toggle-save-failure" value={model.nextSaveFailure} onValueChange={model.setNextSaveFailure} />
      <Flag label="下一次保存响应丢失" testID="toggle-save-unknown" value={model.nextSaveUnknown} onValueChange={model.setNextSaveUnknown} />
      <Flag label="下一次取消确认中断" testID="toggle-cancel-unconfirmed" value={model.nextCancelUnconfirmed} onValueChange={model.setNextCancelUnconfirmed} />
    </Section>
    <Section title="连接与项目列表">
      <Actions>
        <Action label="模拟连接中断" testID="simulate-disconnect" secondary disabled={model.connection !== 'connected'} onPress={() => model.setConnection('disconnected')} />
        <Action label={model.recovering ? '正在查询原任务…' : '恢复连接并查询原任务'} disabled={model.recovering || model.connection === 'unpaired' || model.connection === 'revoked'} testID="tools-recover" secondary onPress={() => { void model.recover(); }} />
        <Action label="模拟项目加载" testID="simulate-loading" secondary onPress={() => model.setCatalogState('loading')} />
        <Action label="模拟项目读取失败" testID="simulate-catalog-error" secondary onPress={() => model.setCatalogState('error')} />
        <Action label="模拟空项目列表" testID="simulate-empty" secondary onPress={() => model.setCatalogState('empty')} />
        <Action label="恢复项目列表" testID="restore-catalog" secondary onPress={() => model.setCatalogState('ready')} />
      </Actions>
      {model.connection === 'unpaired' || model.connection === 'revoked' ? <Copy kind="label">当前设备没有有效配对，必须输入电脑配对码重新连接。恢复按钮不能恢复已撤销的授权。</Copy> : null}
    </Section>
    <Copy kind="label">已有 {model.jobs.length} 次任务请求。联网恢复只查询，不增加这个数字。</Copy>
    <Actions><Action label="返回我的项目" onPress={() => router.navigate('/preview')} /></Actions>
  </Page></>;
}
