import { defineMessages } from '../preferences/Preferences';

export const playerMessages = defineMessages({
  recovering: '正在重新载入原音频，恢复选定的位置…',
  returnCompare: '返回比较', commonRegion: '共同试听片段', candidate: '未保存候选', savedVersion: '已保存版本', ended: '已到末端 · 暂停',
  pairLost: '版本选择已失效。请重新选择已保存版本。', pairReadFailed: '无法确认比较版本。恢复原 Audio/ABC 文件后重新读取；已有历史保留。',
  storageWarning: '选择存储不可用；本次仍可比较，刷新恢复不保证。', refreshRule: '刷新只恢复仍有效的版本选择与 A/B 侧，从 0 秒暂停；播放位置和片段不保留。',
  regionReset: '新比较对的共同区间不包含旧片段，请重新设置。', invalidCommonRegion: '起点须小于终点，且须在两份音频共同区间内。', regionRule: '片段只播放一次，到终点暂停；手动 seek 或调整片段会取消这次限界。',
  compare: '版本 A/B 比较', choosePair: '选择两份已保存版本', versionA: '版本 A', versionB: '版本 B', chooseVersion: '选择版本', oneVersion: '只试听 A', applyPair: '使用这对版本',
  switchA: '切换到 A', switchB: '切换到 B', switchRule: '切换保留绝对秒数，不做拍点对齐；较短目标停在末端，更换比较对从 0 秒暂停。', invalidPair: '请选择本项目两个不同且有音频的已保存版本；只有一份时仍可试听 A。',
  player: '持续试听', empty: '选择一段音乐开始试听', emptyHelp: '从候选、版本或参考音频选择；切换工作区时音乐继续。',
  play: '播放', pause: '暂停', loading: '正在读取音频…', failed: '无法播放这段音频。重新读取后再试；可从素材详情下载原文件检查。', retry: '重新读取音频',
  unavailable: '试听暂时不可用。重新读取音频以恢复播放。', scoreTone: '草稿 MIDI 简单音色 · 所听修订保持不变',
  seek: '播放位置（秒）', region: '试听片段', start: '片段起点（秒）', end: '片段终点（秒）', apply: '设置片段', playRegion: '播放片段',
  invalidRegion: '起点必须小于终点，且片段须在音频时长内。', selected: '已选片段', clock: '播放时间', fake: 'CPU 测试音调', source: '原始音频',
}, {
  recovering: 'Reloading the original audio at the position you chose…',
  returnCompare: 'Return to comparison', commonRegion: 'Common listening region', candidate: 'Unsaved candidate', savedVersion: 'Saved version', ended: 'At the end · Paused',
  pairLost: 'Pair choices are unavailable. Choose saved versions again.', pairReadFailed: 'Comparison versions could not be confirmed. Restore original Audio/ABC files and reread; existing history remains.',
  storageWarning: 'Choice storage is unavailable. You can compare now; reload recovery is not guaranteed.', refreshRule: 'Reload restores only still-valid Version choices and the A/B side, paused at 0. Position and region are not retained.',
  regionReset: 'The new pair cannot contain the previous region. Set a new one.', invalidCommonRegion: 'The start must precede the end and stay within the two clips’ common range.', regionRule: 'A region plays once and pauses at its end. Seeking or editing the region cancels this bounded playback.',
  compare: 'Version A/B comparison', choosePair: 'Choose two saved versions', versionA: 'Version A', versionB: 'Version B', chooseVersion: 'Choose a version', oneVersion: 'Listen to A only', applyPair: 'Use this pair',
  switchA: 'Switch to A', switchB: 'Switch to B', switchRule: 'Switching keeps absolute seconds, without beat alignment. A shorter target stops at its end; a new pair starts paused at 0.', invalidPair: 'Choose two different saved versions with audio in this project. With one version, A can still play.',
  player: 'Continuous listening', empty: 'Choose music to start listening', emptyHelp: 'Select a candidate, version or reference audio. Music continues across workspace tabs.',
  play: 'Play', pause: 'Pause', loading: 'Reading audio…', failed: 'This audio could not play. Reread and try again, or download the original file from asset details to inspect it.', retry: 'Reread audio',
  unavailable: 'Listening is unavailable. Reread audio to restore playback.', scoreTone: 'Simple draft MIDI tone · auditioned revision stays unchanged',
  seek: 'Playback position (seconds)', region: 'Listening region', start: 'Region start (seconds)', end: 'Region end (seconds)', apply: 'Set region', playRegion: 'Play region',
  invalidRegion: 'The start must precede the end, and the region must stay within the audio duration.', selected: 'Selected region', clock: 'Playback time', fake: 'CPU test tone', source: 'Original audio',
});
