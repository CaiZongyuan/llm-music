import { defineMessages } from '../preferences/Preferences';
export const assetMessages = defineMessages({
  title: '从一段参考音频开始', intro: '加入一段你想理解的旋律。原始音频保留在这个项目中，随时可以重新读取。',
  file: '选择 WAV 音频', selected: '已选择', upload: '加入项目素材', uploading: '正在加入…',
  limits: '支持 PCM WAV。转谱的当前验证范围为 16 秒 PCM16，单声道 24 kHz 或立体声 48 kHz。',
  list: '项目素材', empty: '还没有参考音频', emptyBody: '选择一个本地 WAV，把它加入这个项目。',
  refresh: '重新读取素材', detail: '素材详情', choose: '选择素材查看详情', download: '下载原文件', downloading: '正在读取文件…',
  saved: '原文件已保存', format: '文件格式', duration: '时长', seconds: '秒', channels: '声道', rate: '采样率',
  identity: '素材标识', hash: '原文件 SHA256', bytes: '字节', kind: '素材类型',
  reference_audio: '参考音频', generated_audio: '生成音频', score_abc: 'ABC 乐谱', score_midi: 'MIDI 乐谱',
}, {
  title: 'Start with a piece of reference audio', intro: 'Add a melody you want to understand. The original audio stays in this project and can be read again.',
  file: 'Choose WAV audio', selected: 'Selected', upload: 'Add to project assets', uploading: 'Adding…',
  limits: 'PCM WAV is supported. The current verified transcription profile is 16 seconds, PCM16 mono 24 kHz or stereo 48 kHz.',
  list: 'Project assets', empty: 'No reference audio yet', emptyBody: 'Choose a local WAV and add it to this project.',
  refresh: 'Read assets again', detail: 'Asset details', choose: 'Choose an asset to inspect', download: 'Download original file', downloading: 'Reading file…',
  saved: 'Original file saved', format: 'File format', duration: 'Duration', seconds: 'seconds', channels: 'Channels', rate: 'Sample rate',
  identity: 'Asset identity', hash: 'Original file SHA256', bytes: 'bytes', kind: 'Asset type',
  reference_audio: 'Reference audio', generated_audio: 'Generated audio', score_abc: 'ABC score', score_midi: 'MIDI score',
});
