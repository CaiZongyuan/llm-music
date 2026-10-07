import { defineMessages } from '../preferences/Preferences';

export const scoreMessages = defineMessages({
  title: '先看旋律，再听一遍', readonly: '只读乐谱', intro: '检查音符与节奏是否接近你听到的方向。转谱结果需要听辨，不能假定准确。',
  list: '项目乐谱', refresh: '重新读取乐谱', empty: '还没有可以查看的乐谱', emptyBody: '生成音乐或完成一次转谱，就能来到这里检查结果。',
  transcribe: '从参考音频转谱', score: '乐谱', referenceScore: '参考转谱', generatedScore: '音乐生成', open: '查看乐谱', back: '返回项目乐谱',
  notation: '乐谱预览', abc: 'ABC 音乐表示', source: '来源', generated: '音乐生成，无参考音频', job: '关联任务', identity: '乐谱标识',
  reference: '原参考音频', listen: '试听原参考', referenceId: '参考素材标识', midi: '下载 MIDI', downloadAbc: '下载 ABC', downloading: '正在读取文件…',
  missingMidi: '这份乐谱没有已登记的 MIDI。ABC 仍可查看和下载。', downloadFailed: '文件读取失败。已保存的乐谱仍保留，请再次下载。',
  retryDownload: '再次下载', renderFailed: '暂时无法显示谱面。ABC 原文与已保存文件仍保留。', retryRender: '重新显示谱面',
  loadingNotation: '正在显示谱面…', later: '乐谱编辑与重新生成将在后续阶段提供。', fileId: '文件标识',
}, {
  title: 'Look at the melody, then listen again', readonly: 'Read-only score', intro: 'Check whether notes and rhythm match what you hear. Transcription needs listening and may be inaccurate.',
  list: 'Project scores', refresh: 'Read scores again', empty: 'No score to inspect yet', emptyBody: 'Generate music or finish a transcription to inspect its score here.',
  transcribe: 'Transcribe reference audio', score: 'Score', referenceScore: 'Reference transcription', generatedScore: 'Music generation', open: 'Inspect score', back: 'Back to project scores',
  notation: 'Score preview', abc: 'ABC music notation', source: 'Source', generated: 'Music generation, no reference audio', job: 'Related job', identity: 'Score identity',
  reference: 'Original reference audio', listen: 'Listen to original reference', referenceId: 'Reference asset identity', midi: 'Download MIDI', downloadAbc: 'Download ABC', downloading: 'Reading file…',
  missingMidi: 'This score has no registered MIDI. You can still inspect and download its ABC.', downloadFailed: 'The file could not be read. Your saved score remains. Download it again.',
  retryDownload: 'Download again', renderFailed: 'The notation could not be displayed. The original ABC and saved files remain.', retryRender: 'Display notation again',
  loadingNotation: 'Displaying notation…', later: 'Score editing and regeneration will arrive in a later phase.', fileId: 'File identity',
});
