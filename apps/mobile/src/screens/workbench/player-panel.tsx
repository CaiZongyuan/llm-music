import { ActivityIndicator, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { useMobileSession } from '@/data/provider';
import { Action, Actions, Copy, useControlWidth } from './controls';
import { useWorkbenchPlayback, type PlaybackSelection } from './playback-context';
import { SeekControl } from './seek-control';
import { useCreatorAction } from './use-creator-action';

function time(value: number) {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function PlayerPanel({ selection }: { selection: PlaybackSelection }) {
  const media = useWorkbenchPlayback(), action = useCreatorAction(), width = useControlWidth();
  const { state: session } = useMobileSession();
  const current = media?.state.selection?.recordId === selection.recordId && media.state.selection.projectId === selection.projectId;
  const status = current ? media!.state : undefined;
  const loading = status?.status === 'loading' || status?.status === 'authorizing';
  const connected = session.connection === 'connected' && session.foreground;
  const playing = !!status?.playing, position = status?.position ?? 0, duration = status?.duration ?? 0;
  const seekReady = !!status?.canSeek && connected && !action.busy;
  const seek = async (seconds: number) => { await action.run(async () => { await media!.controller.seekTo(seconds); }); };
  return <View style={{ gap: spacing.small }}>
    <Copy kind="label">原始音频 · {selection.label}</Copy>
    <Copy testID={`playback-${selection.recordId}`} style={{ color: colors.accent, fontVariant: ['tabular-nums'] }}>
      {loading ? '正在准备试听' : playing ? '播放中' : status?.ended ? '试听结束' : status?.status === 'ready' ? '已暂停' : '等待试听'} · {time(position)} / {duration > 0 ? time(duration) : '—'}
    </Copy>
    {loading ? <ActivityIndicator color={colors.accent} /> : null}
    {!connected ? <Copy kind="label">试听已暂停。恢复连接后，可明确继续试听。</Copy> : null}
    {status?.seeking ? <Copy kind="label">正在确认跳转位置…</Copy> : null}
    <SeekControl width={width} testID={`seek-${selection.recordId}`} value={position} max={duration} disabled={!seekReady} onSeek={seek} />
    <Actions>
      <Action label={playing ? '暂停试听' : loading ? '正在准备试听…' : status?.status === 'error' ? '重新准备试听' : status?.ended ? '重新试听' : '播放试听'}
        testID={`play-${selection.recordId}`} disabled={!media || !connected || action.busy || !!loading}
        onPress={() => { void action.run(async () => {
          if (playing) { await media!.controller.pause(); return; }
          if (!current || status?.status !== 'ready') await media!.controller.select(selection);
          if (status?.ended) await media!.controller.seekTo(0);
          await media!.controller.play();
        }); }} />
      <Action label="向后跳 10 秒" secondary testID={`seek-forward-${selection.recordId}`} disabled={!seekReady}
        onPress={() => { void seek(Math.min(duration, position + 10)); }} />
      <Action label="从头试听" secondary testID={`seek-start-${selection.recordId}`} disabled={!seekReady}
        onPress={() => { void seek(0); }} />
    </Actions>
    {status?.error || action.error ? <Copy kind="error" testID={`audio-error-${selection.recordId}`}>{action.error || '原始音频暂时无法试听，请重新准备。'}</Copy> : null}
    {!media ? <Copy kind="muted">原始音频试听暂不可用。</Copy> : null}
  </View>;
}
