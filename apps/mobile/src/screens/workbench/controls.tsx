import { Button, Column, Host, Text as NativeText, TextInput, type TextInputProps } from '@expo/ui';
import type { ReactNode } from 'react';
import { Text, View, useWindowDimensions, type TextProps } from 'react-native';

import { colors, fontSize, layout, spacing } from '@/constants/theme';

export function useControlWidth() {
  const { width } = useWindowDimensions();
  return Math.max(0, Math.min(width, layout.maxContentWidth) - spacing.medium * 2);
}

export function Copy({ kind = 'body', style, ...props }: TextProps & { kind?: 'body' | 'muted' | 'label' | 'heading' | 'error' }) {
  return <Text selectable {...props} style={[{
    color: kind === 'error' ? colors.error : kind === 'muted' || kind === 'label' ? colors.muted : colors.text,
    fontSize: kind === 'label' ? fontSize.label : kind === 'heading' ? fontSize.heading : fontSize.body,
    lineHeight: kind === 'label' ? 18 : kind === 'heading' ? 30 : 24,
    fontWeight: kind === 'heading' ? '700' : '400',
  }, style]} />;
}

export function Actions({ children }: { children: ReactNode }) {
  const width = useControlWidth();
  return <Host matchContents colorScheme="dark" seedColor={colors.accent} ignoreSafeArea="all">
    <Column spacing={spacing.small} style={{ width }}>{children}</Column>
  </Host>;
}

export function Action({ label, onPress, secondary = false, disabled = false, testID }: {
  label: string; onPress(): void; secondary?: boolean; disabled?: boolean; testID?: string;
}) {
  return <Button testID={testID} onPress={onPress} disabled={disabled} variant={secondary ? 'outlined' : 'filled'}
    style={{ borderRadius: 4, paddingVertical: spacing.small, backgroundColor: secondary ? colors.panel : colors.accent,
      borderColor: secondary ? colors.line : colors.accent, borderWidth: 1 }}>
    <NativeText textStyle={{ color: secondary ? colors.text : colors.background, fontSize: fontSize.body, fontWeight: '600' }}>{label}</NativeText>
  </Button>;
}

// Uncontrolled native text retains cursor/composition during HTTP/query renders.
// Owners remount only when changing server/record or explicitly replacing input.
export function Field({ label, hint, initialValue, ...props }: Omit<TextInputProps, 'value' | 'defaultValue'> & {
  label: string; hint?: string; initialValue: string;
}) {
  const width = useControlWidth();
  return <View style={{ gap: spacing.small }}>
    <Copy style={{ fontWeight: '600' }}>{label}</Copy>
    <Host matchContents colorScheme="dark" seedColor={colors.accent} ignoreSafeArea="all">
      <TextInput {...props} defaultValue={initialValue} autoCorrect={false}
        cursorColor={colors.accent} selectionColor={colors.accent} placeholderTextColor={colors.muted}
        textStyle={{ color: colors.text, fontSize: fontSize.body }}
        style={{ width, padding: spacing.medium, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, borderRadius: 4 }} />
    </Host>
    {hint ? <Copy kind="label">{hint}</Copy> : null}
  </View>;
}

export function Section({ children, title }: { children: ReactNode; title?: string }) {
  return <View style={{ gap: spacing.medium, paddingTop: spacing.medium, borderTopWidth: 1, borderTopColor: colors.line }}>
    {title ? <Copy kind="heading">{title}</Copy> : null}{children}
  </View>;
}
