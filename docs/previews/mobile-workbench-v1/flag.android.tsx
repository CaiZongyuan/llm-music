import { Host, Switch } from '@expo/ui';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { Text, View } from 'react-native';

import { colors, fontSize, spacing } from '../../../apps/mobile/src/constants/theme';
import type { FlagProps } from './flag';

export function Flag({ label, ...props }: FlagProps) {
  // SDK 57 Go accepts numeric Compose widths. The labeled universal Switch adds IntrinsicSize.Max.
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.small }}>
    <Text style={{ flex: 1, color: colors.text, fontSize: fontSize.body }}>{label}</Text>
    <Host matchContents colorScheme="dark" seedColor={colors.accent} style={{ width: 64 }}>
      <Switch {...props} modifiers={[semantics({ contentDescription: label })]} />
    </Host>
  </View>;
}
