import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';

import { colors } from '../../../apps/mobile/src/constants/theme';
import type { SeekControlProps } from './seek-control';

export function SeekControl({ controlWidth, value, onValueChange, min = 0, max = 1, step, disabled, testID }: SeekControlProps) {
  const [thumbValue, setThumbValue] = useState(value);
  const dragging = useRef(false);

  useEffect(() => {
    if (disabled) dragging.current = false;
    if (!dragging.current) setThumbValue(value);
  }, [value, disabled]);

  // This native SeekBar is bundled in SDK 57 Go. Let it handle dragging, then commit one seek.
  return <Slider testID={testID} accessibilityLabel="试听进度" accessibilityRole="adjustable"
    style={{ width: controlWidth, height: 40 }} minimumValue={min} maximumValue={max} step={step ?? 0}
    value={thumbValue} disabled={disabled} minimumTrackTintColor={colors.accent}
    maximumTrackTintColor={colors.line} thumbTintColor={colors.accent}
    onSlidingStart={start => {
      if (disabled) return;
      dragging.current = true; setThumbValue(start);
    }}
    onSlidingComplete={target => {
      dragging.current = false;
      if (disabled) return;
      setThumbValue(target); onValueChange(target);
    }} />;
}
