import { defineMessages } from '../preferences/Preferences';

export const generationMessages = defineMessages({
  title: '让想法变成一段音乐', intro: '描述一个清楚的方向，用一小段歌词试试。片段长度默认自动跟随歌词，也可以设一个上限。',
  style: '音乐风格', styleHelp: '语言、情绪、乐器与节奏。一次先改变一个方向。', lyrics: '歌词', lyricsHelp: '可以用 [Verse] 和 [Chorus] 组织段落。',
  seed: '随机种子', seedHelp: '保留种子，方便记录这次尝试。', seconds: '片段长度', autoSeconds: '自动（跟随歌词）', secondsHelp: '留空为自动；或输入 5–360 的上限秒数。实际时长不会超过上限，歌词唱完会提前结束。', submit: '生成一段音乐', submitting: '正在提交…',
  decide: '生成后先试听，由你选择是否保存。', invalidSeed: '请输入 0 到 9007199254740991 之间的整数种子。', invalidSeconds: '片段长度须为 5–360 的整数；留空表示自动。', emptyInput: '请填写音乐风格和歌词。',
  latest: '这一次创作', candidates: '候选结果', empty: '还没有候选音乐', emptyBody: '输入风格与歌词，生成后在这里试听并检查乐谱。完成任务不会自动保存版本。',
  listen: '试听这段音乐', score: '查看乐谱', unsaved: '未保存候选', saved: '已保存为版本', save: '保存为版本', saving: '正在保存…',
  name: '版本名称', saveIntro: '留下你喜欢的那一次。版本会保留这次提交的输入和结果。', checkSaved: '重新读取已保存版本', openVersion: '查看已存版本',
  inputSnapshot: '提交时的输入', inputs: '歌词与输入', draftTitle: '这一次创作的歌词', draftHelp: '这里显示当前草稿；不会改写候选或已保存版本。底部音乐继续播放。',
  noLyrics: '还没有输入歌词。', direction: '音乐方向', return: '回到生成，调整歌词', record: '结果记录', provenance: '来源与运行设置',
  fake: 'CPU FakeRuntime 测试音调与示例乐谱，仅供交互验证。', reload: '重新读取候选', job: '创作任务', generation: '音乐生成',
  pick: '选择候选', reuse: '用这次输入继续探索', reuseHelp: '先保持歌词和种子，只改变风格，再试听新的候选。',
  sourceScore: '选定的来源 Score', openSourceScore: '查看提交的来源乐谱', parentVersion: '来源父版本', submittedABC: '实际提交的 ABC', coverMode: '改编模式', reference: '参考素材', transcribedSource: '原始转谱乐谱', effectiveABC: '实际用于推理的有效 ABC', saveCaptured: '本次保存保留第一次点击时的名称与来源。修改名称不会改变正在恢复的保存。', saveSame: '再次保存同一版本',
}, {
  title: 'Turn an idea into music', intro: 'Describe a clear direction and try a short lyric. Clip length follows the lyrics by default; you can also set a ceiling.',
  style: 'Music style', styleHelp: 'Language, mood, instruments and rhythm. Change one direction at a time.', lyrics: 'Lyrics', lyricsHelp: 'Use [Verse] and [Chorus] to organize sections.',
  seed: 'Random seed', seedHelp: 'Keep the seed to record this attempt.', seconds: 'Clip length', autoSeconds: 'Auto (follow the lyrics)', secondsHelp: 'Leave empty for auto; or enter a ceiling of 5–360 seconds. Actual length stays within the ceiling and can end earlier when the lyrics finish.', submit: 'Generate a music clip', submitting: 'Submitting…',
  decide: 'Listen first, then choose whether to save.', invalidSeed: 'Enter an integer seed between 0 and 9007199254740991.', invalidSeconds: 'Clip length must be an integer between 5 and 360; leave it empty for auto.', emptyInput: 'Enter music style and lyrics.',
  latest: 'This creative attempt', candidates: 'Candidates', empty: 'No candidate music yet', emptyBody: 'Enter style and lyrics, then listen and inspect the score here. Completing a job does not save a version.',
  listen: 'Listen to this music', score: 'View score', unsaved: 'Unsaved candidate', saved: 'Saved as a version', save: 'Save as a version', saving: 'Saving…',
  name: 'Version name', saveIntro: 'Keep the attempt you like. The version retains the submitted inputs and results.', checkSaved: 'Reread saved versions', openVersion: 'View saved version',
  inputSnapshot: 'Submitted inputs', inputs: 'Lyrics and inputs', draftTitle: 'Lyrics for this attempt', draftHelp: 'This is the current draft. It does not change candidate or saved version snapshots. Music continues in the player.',
  noLyrics: 'No lyrics entered yet.', direction: 'Music direction', return: 'Return to generation and adjust lyrics', record: 'Result record', provenance: 'Source and generation settings',
  fake: 'CPU FakeRuntime test tone and example score, for interaction checks only.', reload: 'Reread candidates', job: 'Creative job', generation: 'Music generation',
  pick: 'Choose candidate', reuse: 'Explore with these inputs', reuseHelp: 'Keep lyrics and seed, change the style, then listen to a new candidate.',
  sourceScore: 'Selected source Score', openSourceScore: 'Inspect submitted source Score', parentVersion: 'Source parent Version', submittedABC: 'Actually submitted ABC', coverMode: 'Cover mode', reference: 'Reference Asset', transcribedSource: 'Original transcription Score', effectiveABC: 'Effective ABC used for inference', saveCaptured: 'This save retains the name and origin captured at the first click. Editing the name does not change the save being recovered.', saveSame: 'Save the same version again',
});
