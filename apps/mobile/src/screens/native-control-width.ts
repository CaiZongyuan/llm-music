import type { ColumnProps, UniversalHostProps } from '@expo/ui';

export function controlWidthLayout(width: number): {
  host: Pick<UniversalHostProps, 'matchContents' | 'style'>;
  content: Pick<ColumnProps, 'style' | 'modifiers'>;
} {
  return { host: { matchContents: true }, content: { style: { width } } };
}
