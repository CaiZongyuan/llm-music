import { Button, Host } from '@expo/ui';
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, layout, spacing } from '@/constants/theme';
import { useMobileSession } from '@/data/provider';

import { controlWidthLayout } from './native-control-width';
import { Field } from './workbench/controls';

const statusLabels = {
  hydrating: '正在读取手机数据', checking: '正在连接电脑', unpaired: '还未连接电脑', pairing: '正在连接电脑', connected: '电脑已连接',
  disconnected: '连接暂时中断', revoked: '连接暂时中断', server_mismatch: '这个地址对应另一台电脑',
};
const failures: Record<string, string> = {
  invalid_address: '请输入完整的电脑地址，例如 http://192.168.1.8:8001。',
  direct_connection_unavailable: '这台电脑尚未开启局域网直连，请检查电脑服务。',
  storage_unavailable: '无法保存手机数据，已暂停写入操作。输入仍保留。',
  server_mismatch: '电脑身份与已保存记录不一致，请核对地址。',
};

export function ConnectionScreen() {
  const { session, state } = useMobileSession();
  const [address, setAddress] = useState(state.server?.baseUrl ?? '');
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const controlWidth = Math.max(0, Math.min(width, layout.maxContentWidth) - spacing.medium * 2);
  const widthLayout = controlWidthLayout(controlWidth);
  const connecting = state.connection === 'checking';
  return <><Stack.Screen options={{ title: '声间 · 连接电脑' }} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentContainerStyle={{ maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center', padding: spacing.medium,
        paddingBottom: insets.bottom + spacing.large, gap: spacing.large }}>
      <Text style={{ color: colors.accent, fontSize: fontSize.label, letterSpacing: 1 }}>声间 / 我的电脑</Text>
      <Text selectable testID="connection-status" style={{ color: colors.text, fontSize: fontSize.heading, fontWeight: '700' }}>{statusLabels[state.connection]}</Text>
      <Text style={{ color: colors.muted, fontSize: fontSize.body }}>电脑保持运行，手机和电脑连接同一 Wi-Fi。输入电脑地址即可连接。</Text>
      {state.storage === 'error' ? <Text selectable style={{ color: colors.error }}>手机数据暂时不可用，创作写入已暂停。</Text> : null}
      {state.error ? <Text selectable testID="connection-error" style={{ color: colors.error, fontSize: fontSize.body }}>{failures[state.error] ?? '暂时无法连接电脑。请确认地址与电脑服务，输入和草稿仍保留。'}</Text> : null}
      {state.storage === 'error' ? <Host matchContents colorScheme="dark" seedColor={colors.accent}>
        <Button label="重试手机存储" onPress={() => { void session.retryStorage().catch(() => {}); }} />
      </Host> : null}
      {connecting ? <ActivityIndicator color={colors.accent} /> : null}
      <Field label="电脑地址" testID="connect-address" initialValue={address} onChangeText={setAddress} keyboardType="url" autoCapitalize="none"
        placeholder="http://192.168.1.8:8001" />
      <Host {...widthLayout.host} colorScheme="dark" seedColor={colors.accent}>
        <Button testID="connect-submit" label={connecting ? '正在连接…' : state.connection === 'connected' ? '连接此地址' : '连接电脑'}
          disabled={!address.trim() || state.storage !== 'ready' || connecting}
          onPress={() => { void session.connect(address).catch(() => {}); }} />
      </Host>
      {state.connection === 'connected' ? <View style={{ gap: spacing.small }}>
        <Text selectable testID="connected-address" style={{ color: colors.muted }}>{state.server?.baseUrl}</Text>
        <Text style={{ color: colors.muted }}>连接地址已保存，可以进入项目或更换电脑地址。</Text>
        <Host matchContents colorScheme="dark" seedColor={colors.accent}>
          <Button testID="open-workbench" label="进入我的项目" onPress={() => router.replace('/workbench')} />
        </Host>
      </View> : null}
    </ScrollView>
  </>;
}
