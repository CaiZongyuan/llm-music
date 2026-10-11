import { Host, Slider, type SliderProps } from '@expo/ui';

import { colors } from '../../../apps/mobile/src/constants/theme';

export type SeekControlProps = SliderProps & { controlWidth: number };

export function SeekControl({ controlWidth, ...props }: SeekControlProps) {
  return <Host matchContents colorScheme="dark" seedColor={colors.accent} style={{ width: controlWidth }}>
    <Slider {...props} />
  </Host>;
}
