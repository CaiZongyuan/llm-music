import type { ColumnProps, UniversalHostProps } from '@expo/ui';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';

export function controlWidthLayout(width: number): {
  host: Pick<UniversalHostProps, 'matchContents' | 'style'>;
  content: Pick<ColumnProps, 'style' | 'modifiers'>;
} {
  // Compose's Either<Int, IntrinsicSize> width converter rejects JS numbers in Kotlin Maps.
  // RN bounds the Host; Compose fills that bound without a numeric width modifier.
  return {
    host: { matchContents: { vertical: true }, style: { width } },
    content: { modifiers: [fillMaxWidth()] },
  };
}
