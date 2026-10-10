import { ActivityIndicator, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { Action, Actions, Copy } from './controls';
import { creatorMessage } from './use-creator-action';

export function ReadStatus({ data, fetching, error, empty, label, onRetry }: {
  data: unknown; fetching: boolean; error: unknown; empty?: boolean; label: string; onRetry(): void;
}) {
  return <View style={{ gap: spacing.small }}>
    {fetching ? <View style={{ flexDirection: 'row', gap: spacing.small }}><ActivityIndicator color={colors.accent} /><Copy kind="muted">正在读取{label}…</Copy></View> : null}
    {error ? <><Copy kind="error" testID={`${label}-read-error`}>{creatorMessage(error)}{data !== undefined ? ' 已有内容仍保留。' : ''}</Copy>
      <Actions><Action label={`重新读取${label}`} secondary disabled={fetching} onPress={onRetry} /></Actions></> : null}
    {data === undefined && !fetching && !error ? <Copy kind="muted">连接确认后读取{label}。</Copy> : null}
    {data !== undefined && empty ? <Copy kind="muted" testID={`${label}-empty`}>还没有{label}。</Copy> : null}
  </View>;
}
