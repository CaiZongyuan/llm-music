# SPEC-007: Transcription Experience

状态：已确认并发布到 [#7](https://github.com/CaiZongyuan/llm-music/issues/7)。阶段：P0 验证，P1 API，P2 Web。

## Problem Statement

创作者拿到参考音频后需要可检查的 Score 和可交换 MIDI，不能只得到一个不可解释的转谱任务。

## Solution

在 Project 中上传 Reference Audio，执行 SheetSage2 Transcription，呈现 ABC/Score 并允许下载 MIDI，保留源素材和任务来源。

## User Stories

1. As a music creator, I want to upload Reference Audio, so that I can start transcription in a Project.
2. As a music creator, I want to validate an uploaded audio file, so that I can correct unsuitable input before inference.
3. As a music creator, I want to start a Transcribe Job, so that I can turn reference audio into Score.
4. As a music creator, I want to follow the transcription phase, so that I know whether work is queued or running.
5. As a music creator, I want to cancel unwanted transcription, so that I can avoid wasting GPU time.
6. As a music creator, I want to inspect the ABC and rendered Score, so that I can check musical content before editing.
7. As a music creator, I want to download a valid MIDI, so that I can exchange the result with another music tool.
8. As a music creator, I want to keep the reference linked to the Score, so that I can understand its origin.
9. As a music creator, I want to recover after reload, so that I can find completed and failed Jobs again.
10. As a music creator, I want to receive a meaningful failure message, so that I can retry with corrected input.

## Implementation Decisions

- P0 固定样本验证 SheetSage2；P1 通过应用 API 上传和获取素材；P2 加入确认过的浏览器交互，不在 P0 创建产品页。
- 转谱结果作为 Score/ABC 和 MIDI Asset 持久登记，关联原 Reference Audio 与 Job；它不等同于歌词识别。
- 文件格式、内容和实际 Runtime 限制在提交前校验；采用已经验证的可用范围，不宣称无限音频长度或格式支持。
- 完成必须以有效产物导入为准；失败保留参考输入和 Job 错误，不创建成功但空的 Score。
- P2 提供上传、提交、状态、Score 查看和 MIDI 下载；编辑和重新生成在 P3，白盒 Cover 在 P4。

## Testing Decisions

- P1 使用 FastAPI seam 验证 Project→upload→Job→Score/MIDI；P2 浏览器重走同一路径并验证下载格式和 refresh 恢复。
- 真实 SheetSage2 固定样本检查 ABC 解析与 MIDI 内容；覆盖无效音频、缺模型、Runtime 不可用、失败导入和取消。
- Fake Runtime 输出使用合法 fixture，不用 fake 结果推断真实音乐准确率。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- API 与浏览器在对应阶段都能取得有效 ABC/MIDI，并反查源 Reference Audio。
- 错误/取消不损坏源素材；刷新后可恢复 Job、Score 和下载操作。
- GPU 实测范围及音乐输出限制明确记录。

## Out of Scope

ASR/歌词识别、自动完美转谱承诺、P2 深度谱面编辑、MuseScore 级 UI。

## Further Notes

P2 前先交付并确认转谱交互预览；重用统一 Jobs 与 Score 表示。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
