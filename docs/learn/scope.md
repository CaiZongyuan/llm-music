从已经跑通的短片段创作开始。未来能力有独立阶段，教程不会把计划写成可用按钮。

## 当前可用 {#now}

| 想做的事 | 实际范围 |
| --- | --- |
| 从风格与歌词生成 | 当前 35 秒配置；生成音频与 ABC，得到 Candidate，再明确保存 Version。 |
| 参考音频转谱 | 16 秒 PCM16 WAV：mono24k 或 stereo48k，得到 Score、ABC 与 MIDI。 |
| 从选定乐谱生成 | [编辑与重新生成](edit-score.md#regenerate)：在 Web 检查、独立保存选定原生双声部 ABC，再用风格与歌词生成 Candidate；显式保存保留来源 parent。[API](../guides/generate-save-api.md#selected-score) 也可使用同一操作。 |
| 编辑与试听乐谱 | [ABC 编辑器](edit-score.md) 提供谱面、对应 MIDI 试听/导出与独立 Score 保存；旧 Version/Asset 保持原文。 |
| melody/full 乐谱改编 | [参考→检查选定→新风格](cover.md)：已有 Version 的开头16秒或上传T16参考，保留转谱、编辑、真实来源与parent；明确选择去和弦或保留已写和弦，完成后先为Candidate，再明确保存。 |
| 继续尝试 | 在同一 Project 创建新的 Generate，改变风格、歌词或 seed，再下载逐个试听。 |
| 保留与找回 | 应用 id 读取原素材、已完成结果与保存版本；HTTP 读取 Job，WS 可观察阶段，无法确认的操作要先核对。 |

## 随产品阶段加入 {#later}

<p>正式 Web 提供项目素材、任务监控、参考转谱、ABC 编辑与 MIDI 试听/导出、独立 Score 保存、从选定乐谱重新生成、持续试听和明确保存派生版本。界面支持中英双语和亮暗模式。melody/full Cover 保留可检查来源与中间乐谱；内置 A/B 比较尚未交付。长曲长度、任意音频格式或任意音乐的转谱准确率不能从当前短样本推出。</p><p>本站只读取静态文档并播放已有 MP3，与业务写入隔离。创作操作在已启动的本地 Web 或对应 API 中执行。</p>

## 先完成一个小作品 {#next}

<p><a href="./first-music.md">用已验证配方做第一段音乐 →</a></p>
