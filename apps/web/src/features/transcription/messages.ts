import { defineMessages } from '../preferences/Preferences';

export const transcriptionMessages = defineMessages({
  title: '从参考音乐里，找到旋律', intro: '转谱把音乐整理成乐谱与 MIDI，不是歌词识别。先加入参考素材，再选择要转谱的原文件。',
  reference: '选择参考音频', empty: '这里还没有参考素材。先把一个本地 WAV 加入项目。', start: '开始转谱', submitting: '正在提交转谱…',
  profile: '已验证范围：16 秒 PCM16，单声道 24 kHz 或立体声 48 kHz。上传预算 64 MiB/600 秒不表示更长音频已可稳定转谱。',
  unsupported: '这段素材不符合已验证范围。请导出 16 秒 PCM16，单声道 24 kHz 或立体声 48 kHz，再加入项目。',
  result: '听见音乐，也看见它', resultBody: '转谱完成后，乐谱、ABC 与 MIDI 会保存在这个项目中。', openScore: '查看乐谱与下载 MIDI',
  jobs: '转谱任务', refresh: '重新读取任务', selectJob: '查看这次转谱', selectedInput: '这次任务的原参考素材', noJobs: '开始后，这里会显示阶段与结果。',
  readiness: '转谱准备', recheck: '重新检查转谱准备', ready: '可以开始转谱', notReady: '暂时无法开始转谱', fake: '当前使用 CPU 示例管线；结果用于交互验证，不是真实音乐推理。',
  unavailable: '暂时联系不到推理服务。恢复服务后重新检查；项目与原参考仍保留。', missing: '转谱所需模型或能力尚未就绪。准备完成后重新检查。',
  stale: '运行状态已经过期。重新检查，取得当前的准备状态。', unknown: '尚未取得当前转谱准备状态。重新检查后再开始。',
  failed: '转谱请求没有完成', retrySubmit: '再次提交转谱', unconfirmed: '提交结果尚未确认。先重新读取任务列表，确认是否已有这次转谱，再决定是否再次提交。',
  inputFailure: '请重新选择有效参考音频。原项目与素材保持可读。', code: '问题代码', seconds: '秒', referenceId: '参考素材标识', listen: '试听所选参考',
}, {
  title: 'Find the melody in reference music', intro: 'Transcription turns music into notation and MIDI, rather than recognizing lyrics. Add a reference, then choose the original file to transcribe.',
  reference: 'Choose reference audio', empty: 'No reference asset yet. Add a local WAV to this project first.', start: 'Start transcription', submitting: 'Submitting transcription…',
  profile: 'Verified profile: 16 seconds of PCM16, mono 24 kHz or stereo 48 kHz. The 64 MiB/600-second upload budget does not promise stable transcription for longer audio.',
  unsupported: 'This asset does not match the verified profile. Export 16 seconds of PCM16, mono 24 kHz or stereo 48 kHz, then add it to the project.',
  result: 'Hear the music and see its score', resultBody: 'When transcription finishes, its score, ABC and MIDI will be saved in this project.', openScore: 'Inspect score and download MIDI',
  jobs: 'Transcription jobs', refresh: 'Read jobs again', selectJob: 'Inspect this transcription', selectedInput: 'Original reference for this job', noJobs: 'Start transcription to see its phase and result here.',
  readiness: 'Transcription readiness', recheck: 'Check transcription readiness again', ready: 'Ready to transcribe', notReady: 'Transcription cannot start yet', fake: 'The CPU fixture pipeline is active. Its outputs verify interaction, rather than real music inference.',
  unavailable: 'The inference service is unavailable. Restore it, then check again. Your project and original reference remain.', missing: 'Required transcription models or capabilities are not ready. Prepare them, then check again.',
  stale: 'Runtime observations have expired. Check again to read the current readiness.', unknown: 'Current transcription readiness is unknown. Check again before starting.',
  failed: 'The transcription request could not finish', retrySubmit: 'Submit transcription again', unconfirmed: 'Submission is unconfirmed. Read the job list first to check whether this transcription exists before submitting again.',
  inputFailure: 'Choose valid reference audio again. Your original project and assets remain readable.', code: 'Problem code', seconds: 'seconds', referenceId: 'Reference asset identity', listen: 'Listen to selected reference',
});
