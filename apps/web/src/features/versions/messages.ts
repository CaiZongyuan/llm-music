import { defineMessages } from '../preferences/Preferences';

export const versionMessages = defineMessages({
  title: '留下你喜欢的那一次', intro: '版本来自明确保存。新的生成不会覆盖已有版本。', empty: '还没有保存的版本', emptyBody: '先生成并试听候选，再明确保存。',
  generate: '回到音乐生成', reload: '重新读取版本', listen: '试听版本', inspect: '查看版本', details: '已保存版本', created: '保存时间', candidate: '候选结果', parent: '父版本', none: '没有父版本',
  fake: 'CPU FakeRuntime 测试音调与示例乐谱，仅供交互验证。',
}, {
  title: 'Keep the attempt you like', intro: 'Versions are explicitly saved. New generation keeps existing versions intact.', empty: 'No saved versions yet', emptyBody: 'Generate and listen to a candidate, then explicitly save it.',
  generate: 'Return to music generation', reload: 'Reread versions', listen: 'Listen to version', inspect: 'View version', details: 'Saved version', created: 'Saved at', candidate: 'Candidate', parent: 'Parent version', none: 'No parent version',
  fake: 'CPU FakeRuntime test tone and example score, for interaction checks only.',
});
