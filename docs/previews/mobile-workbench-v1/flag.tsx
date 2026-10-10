import { Host, Switch } from '@expo/ui';
import { useWindowDimensions } from 'react-native';

import { colors, layout, spacing } from '../../../apps/mobile/src/constants/theme';

export type FlagProps = {
  label: string; testID: string; value: boolean; onValueChange: (value: boolean) => void;
};

export function Flag(props: FlagProps) {
  const { width } = useWindowDimensions();
  // Keep the shared preview's native control widths in integer dp.
  const controlWidth = Math.floor(Math.max(0, Math.min(width, layout.maxContentWidth) - spacing.medium * 2));
  return <Host matchContents colorScheme="dark" seedColor={colors.accent} style={{ width: controlWidth }}>
    <Switch {...props} />
  </Host>;
}
