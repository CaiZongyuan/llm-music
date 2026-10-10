import { Button, Column, Host, Text as NativeText, TextInput, useNativeState, type TextInputProps } from '@expo/ui';
import { useEffect, useRef, type ReactNode } from 'react';
import { Text, View, useWindowDimensions, type TextProps } from 'react-native';

import { colors, fontSize, layout, spacing } from '@/constants/theme';

export function useControlWidth() {
  const { width } = useWindowDimensions();
  // SDK 57 Compose width modifiers accept integer dp, while window dimensions can be fractional.
  return Math.floor(Math.max(0, Math.min(width, layout.maxContentWidth) - spacing.medium * 2));
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

// The shared state stays alive across query renders and explicit text replacement.
// Only a server/record identity change remounts the owner.
export function Field({ label, hint, initialValue, replacement, ...props }: Omit<TextInputProps, 'value' | 'defaultValue'> & {
  label: string; hint?: string; initialValue: string; replacement?: string | number;
}) {
  const width = useControlWidth();
  const text = useNativeState(initialValue), previousReplacement = useRef(replacement);
  useEffect(() => {
    if (replacement !== previousReplacement.current) {
      previousReplacement.current = replacement;
      text.set(initialValue);
    }
  }, [text, replacement, initialValue]);
  return <View style={{ gap: spacing.small }}>
    <Copy style={{ fontWeight: '600' }}>{label}</Copy>
    <Host matchContents colorScheme="dark" seedColor={colors.accent} ignoreSafeArea="all">
      <TextInput {...props} value={text} autoCorrect={false}
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
