import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/constants/theme';
import { useMobileSession } from '@/data/provider';
import { useProjects } from '@/data/queries';
import { createWorkbenchActions } from './actions';
import { Action, Actions, Copy, Field, Section } from './controls';
import { ConnectionState } from './connection-state';
import { IntentCard } from './intent-card';
import { useTitleDraft } from './title-draft';
import { ReadStatus } from './read-status';
import { useCreatorAction } from './use-creator-action';
import { useCreatorIntents } from './use-creator-intents';

export function ProjectLibraryScreen() {
  const { session, state } = useMobileSession();
  const query = useProjects();
  const actions = useMemo(() => createWorkbenchActions(session), [session]);
  const title = useTitleDraft('project'), action = useCreatorAction();
  const [reset, setReset] = useState(0);
  const insets = useSafeAreaInsets();
  const intents = useCreatorIntents().filter(intent => intent.operation === 'create_project' && ['prepared', 'unknown'].includes(intent.phase));
  const ready = state.connection === 'connected' && state.storage === 'ready' && state.foreground;
  return <><Stack.Screen options={{ title: '声间 · 我的项目' }} />
    <FlatList contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      removeClippedSubviews={false}
      style={{ backgroundColor: colors.background }} data={query.data ?? []} keyExtractor={project => project.id}
      contentContainerStyle={{ maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center', padding: spacing.medium,
        paddingBottom: insets.bottom + spacing.large, gap: spacing.large }}
      ListHeaderComponent={<View style={{ gap: spacing.large }}>
        <Copy kind="label" style={{ color: colors.accent }}>声间 / 我的项目</Copy>
        <Copy kind="heading">把一点灵感，留在手机里。</Copy>
        <ConnectionState />
        <Actions><Action label="电脑连接" secondary testID="open-mobile-connection" onPress={() => router.push('/connect')} /></Actions>
        <Section title="新建项目">
          <Field key={title.key} replacement={reset} label="项目名称" initialValue={title.value} onChangeText={title.set} maxLength={200}
            readOnly={intents.length > 0 || !title.available} testID="new-project-name" placeholder="例如：夜行电台" />
          {title.error ? <Copy kind="error">{title.error}</Copy> : null}
          {action.error ? <Copy kind="error" testID="new-project-error">{action.error}</Copy> : null}
          <Actions><Action label={action.busy ? '正在新建…' : '新建项目'} testID="create-project" disabled={!ready || action.busy || intents.length > 0}
            onPress={() => { void action.run(() => actions.createProject(title.value)).then(result => {
              if (result?.phase === 'confirmed' && result.resourceId) {
                title.set(''); setReset(value => value + 1); void query.refetch();
                router.push({ pathname: '/workbench/projects/[projectId]', params: { projectId: result.resourceId } });
              }
            }); }} /></Actions>
          {intents.map(intent => <IntentCard key={intent.id} intent={intent} onResolved={() => { void query.refetch(); }} />)}
        </Section>
        <Section title="已有项目"><ReadStatus data={query.data} fetching={query.isFetching} error={query.error}
          empty={query.data?.length === 0 && intents.length === 0} label="项目" onRetry={() => { void query.refetch(); }} />
          <Actions><Action label="重新读取项目" testID="refresh-projects" secondary disabled={!ready || query.isFetching}
            onPress={() => { void query.refetch(); }} /></Actions></Section>
      </View>}
      renderItem={({ item }) => <View style={{ gap: spacing.small, padding: spacing.medium, borderLeftWidth: 2, borderLeftColor: colors.accent, backgroundColor: colors.panel }}>
        <Copy kind="heading">{item.name}</Copy>{item.description ? <Copy kind="muted">{item.description}</Copy> : null}
        <Actions><Action label="打开项目" testID={`open-project-${item.id}`} secondary
          onPress={() => router.push({ pathname: '/workbench/projects/[projectId]', params: { projectId: item.id } })} /></Actions>
      </View>} />
  </>;
}
