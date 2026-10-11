import { router, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { layout, spacing } from '@/constants/theme';
import { useVersion } from '@/data/queries';
import { Action, Actions, Copy, Section } from './controls';
import { ConnectionState } from './connection-state';
import { PlayerPanel } from './player-panel';
import { ReadStatus } from './read-status';

export function SavedVersionScreen() {
  const params = useLocalSearchParams<{ projectId: string; versionId: string }>();
  const projectId = typeof params.projectId === 'string' ? params.projectId : '', versionId = typeof params.versionId === 'string' ? params.versionId : '';
  const query = useVersion(projectId, versionId), insets = useSafeAreaInsets(), version = query.data;
  return <><Stack.Screen options={{ title: version?.name ?? '声间 · 已保存版本' }} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: spacing.medium, gap: spacing.large,
      maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center', paddingBottom: insets.bottom + spacing.large }}>
      <ConnectionState /><ReadStatus data={version} fetching={query.isFetching} error={query.error} label="版本" onRetry={() => { void query.refetch(); }} />
      {version ? <>
        <Copy kind="heading" testID="saved-version-name">{version.name}</Copy><Copy kind="label">{new Date(version.created_at).toLocaleString('zh-CN')} 保存</Copy>
        <PlayerPanel selection={{ projectId, assetId: version.audio_asset_id, recordId: version.id, label: version.name }} />
        <Section title="当时的输入"><Copy>{version.inputs.style}</Copy><Copy kind="muted">{version.inputs.lyrics}</Copy>
          <Copy kind="label">Seed {String(version.inputs.seed)} · {version.inputs.max_seconds === 0 ? '自动时长' : `时长上限 ${version.inputs.max_seconds} 秒`}</Copy>
          <Copy kind="label">这个版本保留当时的输入。当前草稿修改不会覆盖它。</Copy>
        </Section>
      </> : null}
      <Actions><Action label="返回项目" secondary onPress={() => router.navigate({ pathname: '/workbench/projects/[projectId]', params: { projectId } })} />
        <Action label="返回我的项目" secondary onPress={() => router.navigate('/workbench')} /></Actions>
    </ScrollView>
  </>;
}
