import { defineMessages } from '../preferences/Preferences';
export const jobMessages = defineMessages({
  title: '创作任务', empty: '还没有创作任务', emptyBody: '项目里的生成与转谱任务会显示在这里。',
  queued: '等待创作资源', running: '正在创作', completed: '已完成', failed: '未完成', cancelled: '已取消',
  Generate: '音乐生成', Transcribe: '参考音频转谱', refresh: '重新读取任务', unknown: '进度未知，当前只显示阶段',
  measured: '已测量进度', cancel: '已提出取消，等待最终确认。', recovery: '正在确认原任务，请重新读取；不会重新提交。',
  preparing: '准备创作', loading_model: '加载音乐模型', planning_score: '规划乐谱', transcribing: '转谱中',
  generating_semantic: '生成音乐结构', synthesizing: '合成音乐', decoding_audio: '解码音频', saving: '保存结果',
  error: '任务没有完成。输入和已有结果仍保留。', code: '问题代码', identity: '任务标识',
}, {
  title: 'Creative jobs', empty: 'No creative jobs yet', emptyBody: 'Generation and transcription jobs for this project appear here.',
  queued: 'Waiting for creative resources', running: 'Creating', completed: 'Completed', failed: 'Failed', cancelled: 'Cancelled',
  Generate: 'Music generation', Transcribe: 'Reference transcription', refresh: 'Read jobs again', unknown: 'Progress is unknown; showing the current phase',
  measured: 'Measured progress', cancel: 'Cancellation requested; waiting for final confirmation.', recovery: 'Confirming the original job. Read it again; it will not be resubmitted.',
  preparing: 'Preparing', loading_model: 'Loading music models', planning_score: 'Planning score', transcribing: 'Transcribing',
  generating_semantic: 'Generating musical structure', synthesizing: 'Synthesizing music', decoding_audio: 'Decoding audio', saving: 'Saving results',
  error: 'This job did not finish. Your input and existing work remain.', code: 'Problem code', identity: 'Job identity',
});
