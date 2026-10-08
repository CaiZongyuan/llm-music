import { defineMessages } from '../features/preferences/Preferences';

export const shellMessages = defineMessages({
  brand: '声间', library: '我的项目', jobs: '创作任务', runtime: '运行状态', settings: '使用设置', projects: '创作项目', local: '本地创作，按你的节奏',
  tagline: '从一点灵感，走到一段喜欢的音乐。', language: '语言', light: '亮色模式', dark: '暗色模式',
  skip: '跳到工作区', openNav: '切换项目导航', home: '返回我的项目', missing: '找不到这个页面',
  missingBody: '这个地址没有对应的工作区。回到项目列表，继续你的创作。',
  busy: '正在读取…', retry: '重新读取', failed: '暂时没有完成这一步',
  network: '暂时联系不到应用服务。恢复连接后，重新读取已保存的数据。',
  invalid: '请检查输入或文件格式，纠正后再试一次。', notFound: '这个项目或素材不存在，请重新选择。',
  unavailable: '文件或应用存储暂时不可用。已有记录仍保留，请检查存储后重新读取。',
  unconfirmed: '保存结果尚未确认。先重新读取项目或素材，确认是否已保存，再决定是否重试。',
  code: '问题代码', identity: '记录标识',
}, {
  brand: 'Shengjian', library: 'My projects', jobs: 'Creative jobs', runtime: 'Runtime', settings: 'Settings', projects: 'Creative projects', local: 'Local creation, at your pace',
  tagline: 'From a small idea to a piece of music you love.', language: 'Language', light: 'Light mode', dark: 'Dark mode',
  skip: 'Skip to workspace', openNav: 'Toggle project navigation', home: 'Back to my projects', missing: 'Page not found',
  missingBody: 'This address has no workspace. Return to your projects to keep creating.',
  busy: 'Reading…', retry: 'Read again', failed: 'This step could not finish',
  network: 'The application is unavailable. Restore the connection, then read your saved work again.',
  invalid: 'Check your input or file format, correct it, then try again.', notFound: 'This project or asset does not exist. Choose it again.',
  unavailable: 'The file or application storage is unavailable. Your records remain. Check storage, then read again.',
  unconfirmed: 'Saving is unconfirmed. Read the project or assets first to check whether it was saved before retrying.',
  code: 'Problem code', identity: 'Record identity',
});
