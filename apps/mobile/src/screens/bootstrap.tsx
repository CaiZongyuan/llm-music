import { Button, Column, Host, TextInput } from '@expo/ui';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, layout, spacing } from '@/constants/theme';

type PreviewState = 'empty' | 'loading' | 'ready' | 'error';
const stateLabels: Record<PreviewState, string> = {
  empty: '预览状态：空', loading: '预览状态：加载中',
  ready: '预览状态：就绪', error: '预览状态：失败',
};

export function BootstrapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // SDK 57 Compose width modifiers require numbers, even though the TS style type allows percentages.
  const controlWidth = Math.max(0, Math.min(width, layout.maxContentWidth) - spacing.large * 2);
  const [message, setMessage] = useState('');
  const [echo, setEcho] = useState('尚未输入文本');
  const [count, setCount] = useState(0);
  const [previewState, setPreviewState] = useState<PreviewState>('empty');

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: spacing.large, paddingBottom: insets.bottom + spacing.large,
        gap: spacing.large, maxWidth: layout.maxContentWidth, width: '100%', alignSelf: 'center' }}>
      <View style={{ gap: spacing.small }}>
        <Text selectable style={{ color: colors.accent, fontSize: fontSize.label }}>MOBILE / BOOTSTRAP</Text>
        <Text selectable testID="bootstrap-ready" style={{ color: colors.text, fontSize: fontSize.heading, fontWeight: '700' }}>移动端已启动</Text>
        <Text selectable style={{ color: colors.muted, fontSize: fontSize.body }}>初始化验证预览。所有操作只写内存。</Text>
        <Host matchContents colorScheme="dark" seedColor={colors.accent}>
          <Button testID="open-workbench-preview" label="打开移动创作预览" onPress={() => router.push('/preview')} />
        </Host>
      </View>
      <View style={{ gap: spacing.small }}>
        <Text selectable style={{ color: colors.text, fontSize: fontSize.body }}>中文输入与原生交互</Text>
        <Host matchContents colorScheme="dark" seedColor={colors.accent}>
          <Column spacing={spacing.small} style={{ width: controlWidth }}>
            <TextInput testID="bootstrap-input" onChangeText={setMessage}
              placeholder="输入一段中文歌词" multiline numberOfLines={2}
              textStyle={{ color: colors.text, fontSize: fontSize.body }} placeholderTextColor={colors.muted}
              style={{ padding: spacing.medium, backgroundColor: colors.panel, borderColor: colors.line,
                borderWidth: 1, width: controlWidth }} />
            <Button testID="bootstrap-echo-button" label="回显文本" onPress={() => setEcho(message || '尚未输入文本')} />
            <Button testID="bootstrap-counter-button" variant="outlined" label="测试点击" onPress={() => setCount(value => value + 1)} />
          </Column>
        </Host>
        <Text selectable testID="bootstrap-echo" style={{ color: colors.text, fontSize: fontSize.body }}>{echo}</Text>
        <Text selectable testID="bootstrap-counter" style={{ color: colors.accent, fontSize: fontSize.body,
          fontVariant: ['tabular-nums'] }}>点击次数：{count}</Text>
      </View>
      <View style={{ gap: spacing.small }}>
        <Text selectable testID="bootstrap-state" style={{ color: previewState === 'error' ? colors.error : colors.text,
          fontSize: fontSize.body }}>{stateLabels[previewState]}</Text>
        {previewState === 'loading' ? <ActivityIndicator color={colors.accent} accessibilityLabel="模拟加载中" /> : null}
        <Text selectable style={{ color: colors.muted, fontSize: fontSize.label }}>手动切换演示状态，未连接业务 API 或 GPU。</Text>
        <Host matchContents colorScheme="dark" seedColor={colors.accent}>
          <Column spacing={spacing.small} style={{ width: controlWidth }}>
            <Button testID="bootstrap-load" label={previewState === 'error' ? '重新加载' : '模拟加载'} onPress={() => setPreviewState('loading')} />
            <Button testID="bootstrap-complete" variant="outlined" label="完成加载" disabled={previewState !== 'loading'} onPress={() => setPreviewState('ready')} />
            <Button testID="bootstrap-fail" variant="outlined" label="模拟失败" onPress={() => setPreviewState('error')} />
            <Button testID="bootstrap-reset" variant="text" label="恢复空状态" onPress={() => setPreviewState('empty')} />
          </Column>
        </Host>
      </View>
    </ScrollView>
  );
}
