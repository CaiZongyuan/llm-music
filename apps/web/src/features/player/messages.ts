import { defineMessages } from '../preferences/Preferences';

export const playerMessages = defineMessages({
  player: '持续试听', empty: '选择一段音乐开始试听', emptyHelp: '从候选、版本或参考音频选择；切换工作区时音乐继续。',
  play: '播放', pause: '暂停', loading: '正在读取音频…', failed: '无法播放这段音频。重新读取后再试；可从素材详情下载原文件检查。', retry: '重新读取音频',
  unavailable: '试听暂时不可用。重新读取音频以恢复播放。', scoreTone: '草稿 MIDI 简单音色 · 所听修订保持不变',
  seek: '播放位置（秒）', region: '试听片段', start: '片段起点（秒）', end: '片段终点（秒）', apply: '设置片段', playRegion: '播放片段',
  invalidRegion: '起点必须小于终点，且片段须在音频时长内。', selected: '已选片段', clock: '播放时间', fake: 'CPU 测试音调', source: '原始音频',
}, {
  player: 'Continuous listening', empty: 'Choose music to start listening', emptyHelp: 'Select a candidate, version or reference audio. Music continues across workspace tabs.',
  play: 'Play', pause: 'Pause', loading: 'Reading audio…', failed: 'This audio could not play. Reread and try again, or download the original file from asset details to inspect it.', retry: 'Reread audio',
  unavailable: 'Listening is unavailable. Reread audio to restore playback.', scoreTone: 'Simple draft MIDI tone · auditioned revision stays unchanged',
  seek: 'Playback position (seconds)', region: 'Listening region', start: 'Region start (seconds)', end: 'Region end (seconds)', apply: 'Set region', playRegion: 'Play region',
  invalidRegion: 'The start must precede the end, and the region must stay within the audio duration.', selected: 'Selected region', clock: 'Playback time', fake: 'CPU test tone', source: 'Original audio',
});
