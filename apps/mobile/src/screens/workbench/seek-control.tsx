import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState } from 'react';
import { colors } from '@/constants/theme';

export function SeekControl({ width, value, max, disabled, onSeek, testID }: {
  width: number; value: number; max: number; disabled: boolean; onSeek(seconds: number): Promise<void>; testID: string;
}) {
  const [thumb, setThumb] = useState(value);
  const dragging = useRef(false), committing = useRef(false), latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    if (disabled) dragging.current = false;
    if (!dragging.current && !committing.current) setThumb(value);
  }, [value, disabled]);
  // SDK57 universal Slider lacks a gesture-end callback. The bundled native
  // SeekBar preserves the confirmed Android fix and commits one authorized seek.
  return <Slider testID={testID} accessibilityLabel="试听进度" accessibilityRole="adjustable"
    style={{ width, height: 40 }} value={thumb} minimumValue={0} maximumValue={Math.max(1, max)} disabled={disabled}
    minimumTrackTintColor={colors.accent} maximumTrackTintColor={colors.line} thumbTintColor={colors.accent}
    onSlidingStart={start => { if (!disabled) { dragging.current = true; setThumb(start); } }}
    onValueChange={target => { if (dragging.current) setThumb(target); }}
    onSlidingComplete={target => {
      dragging.current = false;
      if (disabled) return;
      committing.current = true; setThumb(target);
      void onSeek(target).finally(() => { committing.current = false; setThumb(latest.current); });
    }} />;
}
