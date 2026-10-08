import { defineMessages } from '../preferences/Preferences';

export const settingsMessages = defineMessages({
  title: '专注音乐，其他按需查看', intro: '这里说明应用环境支持的设置与限制。配置展示为只读。',
  metadata: '应用配置参考', defaults: '下列数值是 API 声明的默认值，不是当前进程的生效配置。实际覆盖值由启动环境控制；本页不保存服务器配置。',
  environment: '环境变量', default: '声明默认值', constraint: '字段规则', refresh: '重新读取配置参考', runtime: '查看运行状态',
  source: '事实来源', prefix: '环境变量前缀', missing: '尚无配置字段', unspecified: '未声明',
  data_dir: '应用数据目录', max_upload_bytes: '上传文件大小上限', max_audio_seconds: '音频接收时长上限', runtime_mode: '推理模式',
  runtime_url: '本地推理服务地址', runtime_timeout_seconds: '底层 HTTP 等待上限', runtime_evidence_path: '只读环境校验记录路径',
  diagnostics_max_age_seconds: '观测有效期', recovery_confirmation_window_seconds: '任务恢复确认时限', recovery_max_attempts: '任务恢复尝试上限',
  recovery_poll_interval_seconds: '任务恢复初始轮询间隔', recovery_max_poll_interval_seconds: '任务恢复最大轮询间隔',
  creativeScope: '当前创作范围', generation: '风格与歌词用于音乐生成；结果先为候选，试听后由你明确保存为版本。',
  uploads: '音频接收上限不代表转谱支持所有音频。创作表单与服务端会检查当前支持的格式、长度和参数。',
  seed: '网页整数种子须在 JavaScript 安全整数范围内。模型与能力就绪后才能开始新的任务。',
  recovery: '暂时无法开始时，先查看运行状态。区分缺模型、下载中、校验失败、失联与过期观测，再重新检查。',
}, {
  title: 'Focus on music; inspect the rest when needed', intro: 'Supported application environment settings and limits. Configuration is read-only.',
  metadata: 'Application configuration reference', defaults: 'Values below are defaults declared by the API, rather than the current process configuration. The launch environment controls overrides; this page does not save server configuration.',
  environment: 'Environment variable', default: 'Declared default', constraint: 'Field rules', refresh: 'Read configuration reference again', runtime: 'View Runtime status',
  source: 'Fact source', prefix: 'Environment variable prefix', missing: 'No configuration fields', unspecified: 'Not declared',
  data_dir: 'Application data directory', max_upload_bytes: 'Upload file size limit', max_audio_seconds: 'Audio acceptance duration limit', runtime_mode: 'Inference mode',
  runtime_url: 'Local inference service address', runtime_timeout_seconds: 'Native HTTP timeout', runtime_evidence_path: 'Read-only environment evidence path',
  diagnostics_max_age_seconds: 'Observation freshness window', recovery_confirmation_window_seconds: 'Job recovery confirmation window', recovery_max_attempts: 'Job recovery attempt limit',
  recovery_poll_interval_seconds: 'Initial Job recovery polling interval', recovery_max_poll_interval_seconds: 'Maximum Job recovery polling interval',
  creativeScope: 'Current creation scope', generation: 'Style and lyrics guide music generation. Results begin as Candidates; listen, then explicitly save a Version.',
  uploads: 'Audio acceptance limits do not mean every audio file supports transcription. Creation forms and the server validate the supported format, length and parameters.',
  seed: 'Web integer seeds must stay within the JavaScript safe integer range. Models and capabilities must be ready before a new Job can start.',
  recovery: 'If creation cannot start, view Runtime status first. Distinguish missing, downloading or invalid models, disconnected services and expired observations, then check again.',
});
