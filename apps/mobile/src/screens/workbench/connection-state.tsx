import { useMobileSession } from '@/data/provider';
import { router } from 'expo-router';
import { View } from 'react-native';
import { spacing } from '@/constants/theme';
import { Action, Actions, Copy } from './controls';
import { useCreatorAction } from './use-creator-action';

export function ConnectionState() {
  const { session, state } = useMobileSession();
  const action = useCreatorAction();
  if (state.connection === 'connected' && state.storage === 'ready') return null;
  const checking = state.connection === 'checking' || state.connection === 'pairing';
  const needsPairing = ['unpaired', 'revoked', 'server_mismatch'].includes(state.connection) || state.error === 'credential_missing';
  return <View style={{ gap: spacing.small }}>
    <Copy kind="muted" testID="workbench-connection">{checking ? '正在确认电脑连接…' : state.connection === 'revoked' ? '电脑已撤销这台手机的授权。编辑内容仍保留。' : '电脑连接尚未确认。编辑内容保留，写入与试听已暂停。'}</Copy>
    {state.storage === 'error' ? <Copy kind="error">手机数据保存失败，输入仍保留。</Copy> : null}
    {action.error ? <Copy kind="error">{action.error}</Copy> : null}
    <Actions>
      {state.storage === 'error' && state.error !== 'credential_missing' ? <Action label="重试手机存储" disabled={action.busy} onPress={() => { void action.run(() => session.retryStorage()); }} /> : null}
      {needsPairing ? <Action label="连接电脑 / 重新授权" onPress={() => router.push('/connect')} /> : <Action label={checking ? '正在确认连接…' : '恢复连接并查询原请求'}
        testID="workbench-reconnect" disabled={checking || action.busy || !state.foreground} onPress={() => { void action.run(() => session.verify()); }} />}
    </Actions>
  </View>;
}
