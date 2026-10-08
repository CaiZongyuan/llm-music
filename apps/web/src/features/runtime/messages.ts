import { defineMessages } from '../preferences/Preferences';

export const capabilityMessages = defineMessages({
  Transcribe: '转谱准备', Generate: '音乐生成准备', GenerateFromScore: '音乐生成准备', Cover: '改编准备', recheck: '重新检查准备状态', ready: '可以开始创作', notReady: '暂时无法开始创作',
  unavailable: '暂时联系不到推理服务。恢复服务后重新检查；项目与已有输入仍保留。',
  missing: '所需模型或能力尚未就绪。准备完成后重新检查。', stale: '运行观测已经过期。重新检查，取得当前准备状态。',
  unknown: '尚未取得当前准备状态。重新检查后再开始。', fake: '当前使用 CPU 示例管线；结果用于交互验证，不是真实音乐推理。', code: '问题代码',
}, {
  Transcribe: 'Transcription readiness', Generate: 'Music generation readiness', GenerateFromScore: 'Music generation readiness', Cover: 'Cover readiness', recheck: 'Check readiness again', ready: 'Ready to create', notReady: 'Creation cannot start yet',
  unavailable: 'The inference service is unavailable. Restore it, then check again. Your project and existing inputs remain.',
  missing: 'Required models or capabilities are not ready. Prepare them, then check again.', stale: 'Runtime observations have expired. Check again to read current readiness.',
  unknown: 'Current readiness is unknown. Check again before starting.', fake: 'The CPU fixture pipeline is active. Its outputs verify interaction, rather than real music inference.', code: 'Problem code',
});
