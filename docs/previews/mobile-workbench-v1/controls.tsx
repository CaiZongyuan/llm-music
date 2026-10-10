import { Button, Column, Host, Text as NativeText, TextInput } from '@expo/ui';
import type { TextInputProps } from '@expo/ui';
import type { ReactNode } from 'react';
import { ScrollView, Text, View, useWindowDimensions, type TextProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, layout, spacing } from '../../../apps/mobile/src/constants/theme';
import { controlWidthLayout } from '../../../apps/mobile/src/screens/native-control-width';

export { colors, fontSize, layout, spacing };
export { Flag } from './flag';

export function useControlWidth(inset = 0) {
  const { width } = useWindowDimensions();
  return Math.max(0, Math.min(width, layout.maxContentWidth) - spacing.medium * 2 - inset);
}

export function Copy({ kind = 'body', style, ...props }: TextProps & { kind?: 'body' | 'muted' | 'label' | 'heading' | 'error' }) {
  return <Text selectable {...props} style={[{
    color: kind === 'error' ? colors.error : kind === 'muted' || kind === 'label' ? colors.muted : colors.text,
    fontSize: kind === 'label' ? fontSize.label : kind === 'heading' ? fontSize.heading : fontSize.body,
    lineHeight: kind === 'label' ? 18 : kind === 'heading' ? 30 : 24,
    fontWeight: kind === 'heading' ? '700' : '400',
  }, style]} />;
}

export function Page({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag" contentContainerStyle={{
      width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center',
      padding: spacing.medium, paddingBottom: insets.bottom + spacing.large, gap: spacing.large,
    }}>{children}</ScrollView>;
}

export function PreviewNotice() {
  return <View style={{ borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: spacing.small, gap: 4 }}>
    <Copy kind="label" style={{ color: colors.accent, letterSpacing: 1 }}>声间 / 交互预览</Copy>
    <Copy kind="label">演示数据只在本次打开期间保留，生成与配对均为模拟。</Copy>
  </View>;
}

export function Actions({ children, inset = 0 }: { children: ReactNode; inset?: number }) {
  const width = useControlWidth(inset);
  const widthLayout = controlWidthLayout(width);
  return <Host {...widthLayout.host} colorScheme="dark" seedColor={colors.accent} ignoreSafeArea="all">
    <Column {...widthLayout.content} spacing={spacing.small}>{children}</Column>
  </Host>;
}

export function Action({ label, onPress, secondary = false, disabled = false, testID }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; testID?: string;
}) {
  return <Button testID={testID} onPress={onPress} disabled={disabled} variant={secondary ? 'outlined' : 'filled'}
    style={{ borderRadius: 4, paddingVertical: spacing.small,
      backgroundColor: secondary ? colors.panel : colors.accent,
      borderColor: secondary ? colors.line : colors.accent, borderWidth: 1 }}>
    <NativeText textStyle={{ color: secondary ? colors.text : colors.background, fontSize: fontSize.body, fontWeight: '600' }}>{label}</NativeText>
  </Button>;
}

export function Field({ label, hint, initialValue, onChangeText, ...props }: Omit<TextInputProps, 'value' | 'defaultValue'> & {
  label: string; hint?: string; initialValue: string;
}) {
  const width = useControlWidth();
  const widthLayout = controlWidthLayout(width);
  return <View style={{ gap: spacing.small }}>
    <Copy style={{ fontWeight: '600' }}>{label}</Copy>
    <Host {...widthLayout.host} colorScheme="dark" seedColor={colors.accent} ignoreSafeArea="all">
      <TextInput {...props} defaultValue={initialValue} onChangeText={onChangeText} autoCorrect={false}
        cursorColor={colors.accent} selectionColor={colors.accent} placeholderTextColor={colors.muted}
        textStyle={{ color: colors.text, fontSize: fontSize.body }}
        modifiers={widthLayout.content.modifiers ? [...widthLayout.content.modifiers, ...(props.modifiers ?? [])] : props.modifiers}
        style={{ ...widthLayout.content.style, padding: spacing.medium, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 4 }} />
    </Host>
    {hint ? <Copy kind="label">{hint}</Copy> : null}
  </View>;
}

export function Section({ children, title }: { children: ReactNode; title?: string }) {
  return <View style={{ gap: spacing.medium, paddingTop: spacing.medium, borderTopWidth: 1, borderTopColor: colors.line }}>
    {title ? <Copy kind="heading">{title}</Copy> : null}{children}
  </View>;
}
