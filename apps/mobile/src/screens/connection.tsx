import { Button, Column, Host, TextInput } from '@expo/ui';
import { router } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, layout, spacing } from '@/constants/theme';
import { useMobileSession } from '@/data/provider';

import { controlWidthLayout } from './native-control-width';

const statusLabels = {
  hydrating: '正在读取手机数据', checking: '正在确认电脑连接', unpaired: '还未连接电脑', pairing: '正在确认配对', connected: '电脑已连接',
  disconnected: '连接暂时中断', revoked: '设备配对已被撤销', server_mismatch: '这个地址对应另一台电脑',
};
const failures: Record<string, string> = {
  invalid_address: '请输入电脑显示的完整地址。', invalid_pairing: '填写六位配对码和手机名称。',
  pairing_invalid: '配对码不正确，请核对电脑上的短码。', pairing_expired: '配对码已过期，请在电脑上重新打开配对窗口。',
  pairing_locked: '本次配对窗口已关闭，请在电脑上生成新的短码。',
  secure_storage_unavailable: '手机未能安全保存设备凭据，配对请求已停止。输入仍保留。',
  storage_unavailable: '无法保存手机数据，已暂停写入操作。输入仍保留。',
  credential_missing: '手机上的设备凭据已丢失。草稿会保留，需要使用电脑配对码重新授权。',
  server_mismatch: '电脑身份与已保存记录不一致，请核对地址。',
};

export function ConnectionScreen() {
  const { session, state } = useMobileSession();
  const [address, setAddress] = useState(state.server?.baseUrl ?? '');
  const [code, setCode] = useState('');
  const [name, setName] = useState('我的手机');
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const controlWidth = Math.max(0, Math.min(width, layout.maxContentWidth) - spacing.medium * 2);
  const widthLayout = controlWidthLayout(controlWidth);
  const freshAuthorization = state.connection === 'revoked' || state.error === 'credential_missing';
  return <><Stack.Screen options={{ title: '声间 · 连接电脑' }} />
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center', padding: spacing.medium,
        paddingBottom: insets.bottom + spacing.large, gap: spacing.large }}>
      <Text style={{ color: colors.accent, fontSize: fontSize.label, letterSpacing: 1 }}>声间 / 我的电脑</Text>
      <Text selectable testID="connection-status" style={{ color: colors.text, fontSize: fontSize.heading, fontWeight: '700' }}>{statusLabels[state.connection]}</Text>
      <Text style={{ color: colors.muted, fontSize: fontSize.body }}>电脑保持运行，手机和电脑连接同一 Wi-Fi。输入电脑显示的地址与短时配对码。</Text>
      {state.storage === 'error' ? <Text selectable style={{ color: colors.error }}>手机数据暂时不可用，创作写入已暂停。</Text> : null}
      {state.error ? <Text selectable testID="connection-error" style={{ color: colors.error, fontSize: fontSize.body }}>{failures[state.error] ?? '暂时无法确认连接。保留原输入，重新打开应用会先查询已保存的设备。'}</Text> : null}
      {state.storage === 'error' && state.error !== 'credential_missing' ? <Host matchContents colorScheme="dark" seedColor={colors.accent}>
        <Button label="重试手机存储" onPress={() => { void session.retryStorage().catch(() => {}); }} />
      </Host> : null}
      {state.connection === 'pairing' || state.connection === 'checking' ? <ActivityIndicator color={colors.accent} /> : null}
      {state.connection === 'connected' ? <View style={{ gap: spacing.small }}>
        <Text selectable style={{ color: colors.text }}>{state.server?.deviceName}</Text>
        <Text selectable testID="connected-address" style={{ color: colors.muted }}>{state.server?.baseUrl}</Text>
        <Text style={{ color: colors.muted }}>设备凭据已安全保存。</Text>
        <Host matchContents colorScheme="dark" seedColor={colors.accent}>
          <Button testID="open-workbench" label="进入我的项目" onPress={() => router.replace('/workbench')} />
        </Host>
      </View> : <Host {...widthLayout.host} colorScheme="dark" seedColor={colors.accent}>
        <Column {...widthLayout.content} spacing={spacing.medium}>
          <TextInput testID="pair-address" defaultValue={address} onChangeText={setAddress} keyboardType="url" autoCapitalize="none" placeholder="电脑地址，例如 http://192.168.1.8:8001"
            placeholderTextColor={colors.muted} textStyle={{ color: colors.text, fontSize: fontSize.body }}
            modifiers={widthLayout.content.modifiers}
            style={{ ...widthLayout.content.style, padding: spacing.medium, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line }} />
          <TextInput testID="pair-code" onChangeText={setCode} keyboardType="number-pad" placeholder="电脑显示的六位配对码"
            maxLength={6} placeholderTextColor={colors.muted} textStyle={{ color: colors.text, fontSize: fontSize.body }}
            modifiers={widthLayout.content.modifiers}
            style={{ ...widthLayout.content.style, padding: spacing.medium, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line }} />
          <TextInput testID="pair-name" defaultValue={name} onChangeText={setName} placeholder="手机名称" maxLength={200}
            placeholderTextColor={colors.muted} textStyle={{ color: colors.text, fontSize: fontSize.body }}
            modifiers={widthLayout.content.modifiers}
            style={{ ...widthLayout.content.style, padding: spacing.medium, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line }} />
          <Button testID="pair-submit" label={freshAuthorization ? '重新授权' : '确认配对'} disabled={state.storage !== 'ready' && !freshAuthorization || state.connection === 'pairing' || state.connection === 'checking'}
            onPress={() => { void session.pair(address, code, name, freshAuthorization).catch(() => {}); }} />
        </Column>
      </Host>}
    </ScrollView>
  </>;
}
