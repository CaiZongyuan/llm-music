import { defineMessages } from '../preferences/Preferences';

export const versionMessages = defineMessages({
  title: '留下你喜欢的那一次', intro: '版本来自明确保存。新的生成不会覆盖已有版本。', empty: '还没有保存的版本', emptyBody: '先生成并试听候选，再明确保存。',
  generate: '回到音乐生成', reload: '重新读取版本', listen: '试听版本', inspect: '查看版本', details: '已保存版本', created: '保存时间', candidate: '候选结果', parent: '父版本', none: '没有父版本',
  fake: 'CPU FakeRuntime 测试音调与示例乐谱，仅供交互验证。',
  branch: '从此版本继续创作', reuse: '使用此版本输入',
  origin: '这次创作的起点', originHelp: '保留当前草稿。需要这份版本的风格、歌词与种子时，再明确使用它的输入；乐谱仍需检查并选定。',
  originInvalid: '无法确认这个版本拥有当前乐谱。', originRecovery: '草稿已保留。重新读取起点，或回到实际版本重新开始；不会改用其他父版本。', originChanged: '请为这个起点检查并明确选定乐谱。',
  relationships: '已保存版本关系', root: '独立起点', relationsInvalid: '版本关系无法确认。', relationsRecovery: '请重新读取完整历史。缺失的父版本或异常关系不会被补成新的起点。',
  outputs: '已保存输出', outputAudio: '音频素材', outputScore: '输出乐谱', outputRecord: '查看输出快照', savedSnapshot: '这些是保存时的输出标识与快照，后续草稿不会改写它们。',
}, {
  title: 'Keep the attempt you like', intro: 'Versions are explicitly saved. New generation keeps existing versions intact.', empty: 'No saved versions yet', emptyBody: 'Generate and listen to a candidate, then explicitly save it.',
  generate: 'Return to music generation', reload: 'Reread versions', listen: 'Listen to version', inspect: 'View version', details: 'Saved version', created: 'Saved at', candidate: 'Candidate', parent: 'Parent version', none: 'No parent version',
  fake: 'CPU FakeRuntime test tone and example score, for interaction checks only.',
  branch: 'Continue from this version', reuse: 'Use this version’s inputs',
  origin: 'Starting point for this creation', originHelp: 'Your current draft remains. Explicitly use this version’s inputs to copy style, lyrics and seed; inspect and select the Score separately.',
  originInvalid: 'This Version could not be confirmed as the owner of this Score.', originRecovery: 'Your draft remains. Reread the starting point, or return to the actual Version; another parent will not be substituted.', originChanged: 'Inspect and explicitly select a Score for this starting point.',
  relationships: 'Saved Version relationships', root: 'Independent starting point', relationsInvalid: 'Version relationships could not be confirmed.', relationsRecovery: 'Reread the complete history. A missing parent or invalid relationship will not become a new starting point.',
  outputs: 'Saved outputs', outputAudio: 'Audio Asset', outputScore: 'Output Score', outputRecord: 'Inspect output snapshot', savedSnapshot: 'These output identities and snapshots were captured at saving. Later drafts do not change them.',
});
