# SPEC-009: Score Workspace

状态：已确认并发布到 [#9](https://github.com/CaiZongyuan/llm-music/issues/9)。阶段：P2 查看，P3 编辑与重新生成。

## Problem Statement

创作者若无法检查与修改 AI 生成的 Score，只能反复碰运气生成，无法建立可控创作闭环。

## Solution

以 ABC 为源表示，提供文本编辑、谱面预览、MIDI 试听/导出，并将明确选定的编辑结果送入 GenerateFromScore。

## User Stories

1. As a music creator, I want to view an ABC Score, so that I can inspect generated musical content.
2. As a music creator, I want to edit ABC text, so that I can control the next generation input.
3. As a music creator, I want to preview notation while editing, so that I can see the effect of changes.
4. As a music creator, I want to see syntax errors without losing text, so that I can fix invalid ABC.
5. As a music creator, I want to play back the edited Score, so that I can listen before GPU generation.
6. As a music creator, I want to export MIDI from the current valid Score, so that I can use it in other tools.
7. As a music creator, I want to generate from my selected Score, so that the intended edit reaches inference.
8. As a music creator, I want to save a regenerated Candidate with its parent, so that the creative change has a traceable origin.
9. As a music creator, I want to retain the original saved Score, so that experiments do not rewrite old Versions.
10. As a music creator, I want to review an isolated editor preview, so that I can approve the interaction before implementation.

## Implementation Decisions

- Score 为 first-class 对象，ABC 为 source；abcjs 提供 staff rendering、playback visualization 与基本交互。MIDI 是派生试听/交换结果。
- 首版编辑限于 ABC text、score preview、MIDI export 与 playback；Transpose/Tempo/Chord 编辑器与 Piano Roll 属后续能力。
- 无效 ABC 保留编辑文本和定位错误，不能提交 GenerateFromScore。解析或渲染失败不覆盖上一份有效保存结果。
- GenerateFromScore 使用明确选定的有效 ABC、style、lyrics 与 settings，保存实际提交的 Score 快照；避免异步编辑导致所听/所提交的 Score 不一致。
- 新 Audio/Score 先是 Candidate，经明确保存形成具有来源 parent_version 的 Version；旧 Version 与素材内容不可被草稿覆盖。
- 编辑器、试听与重新生成先确认可运行隔离预览，再实施并真实浏览器对照。

## Testing Decisions

- 主要从浏览器编辑文本、预览/播放、导出、提交并查询实际输入与结果；通过 FastAPI seam 检查提交 ABC 确实是选定版本。
- 覆盖 ABC 无效、预览/播放失败、导出失败、Runtime 失败和编辑中提交竞态；有效输入不被错误草稿替换。
- ABC 验证存在纯逻辑时用少量音乐 fixture 检查可观察解析行为，不测试第三方 renderer 内部结构。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- 编辑→preview→MIDI playback/export 在浏览器可用，错误可恢复且不丢文本。
- 选定 Score→GenerateFromScore→新 Audio Candidate→显式保存新 Version 可完整验证。
- 父版本和实际输入快照准确，原保存结果不变。

## Out of Scope

完整 DAW、Piano Roll、MuseScore 替代、高阶自动改和弦/转调工具。

## Further Notes

等待 Web MVP gate；复用 SPEC-003 的 Score/Asset 与 SPEC-008 的 Candidate 语义。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
