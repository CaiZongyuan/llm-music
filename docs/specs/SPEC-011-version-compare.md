# SPEC-011: Versioning & Compare

状态：已确认并发布到 [#11](https://github.com/CaiZongyuan/llm-music/issues/11)。阶段：P1 保存/父关系，P5 分支与比较。

## Problem Statement

创作者需要保留不同风格、歌词与乐谱的创作分支，并快速试听差异，线性文件名历史无法解释它们的来源。

## Solution

显式保存带 parent 的 Version，在 P5 呈现分支并提供同一 Workspace 中的 A/B Audio 比较。

## User Stories

1. As a music creator, I want to save a chosen Candidate as a Version, so that successful experiments can become durable work.
2. As a music creator, I want to select a parent Version, so that new work retains its creative origin.
3. As a music creator, I want to branch from an earlier Version, so that I can explore alternatives without overwriting the latest.
4. As a music creator, I want to see the Project version graph, so that I can understand how experiments relate.
5. As a music creator, I want to inspect inputs and outputs of a Version, so that I can understand what changed.
6. As a music creator, I want to select two Versions for comparison, so that I can evaluate different creative directions.
7. As a music creator, I want to switch A/B audio quickly, so that I do not need to open files repeatedly.
8. As a music creator, I want to seek and inspect waveform regions, so that I can focus listening on a passage.
9. As a music creator, I want to keep listening across Workspace tabs, so that comparison stays available while inspecting Score.
10. As a music creator, I want to reopen a saved branch after reload, so that history remains stable.

## Implementation Decisions

- Version 是创作者明确保存的记录，具有 Project 归属、可选 parent、输入快照、相关 Assets 与 provenance。Candidate 和 Job 不自动变为 Version。
- 基础 parent 从 P1 保留，P5 添加 branch/graph 的用户操作和表示；验证同 Project 父关系且不能构成环。
- 比较选择两个有有效 Audio 的 Version，持续播放器支持 A/B、seek 与 regions。不同长度/结束边界有明确行为；不能要求不存在的精确音频对齐。
- A/B 切换在同一播放区域完成，避免同时重复播放两条；切换 Score/lyrics/settings 不卸载持续 Player。
- P5 先交付并确认分支/compare 可运行预览，后实施；空历史、只有一个版本、缺音频、播放错误和刷新恢复均为相关状态。

## Testing Decisions

- FastAPI seam 验证 save、parent 归属、不可覆盖快照与恢复；浏览器从旧 Version 建分支并检查图关系与新结果。
- 浏览器实际播放两份可用音频，切换 A/B、seek、短音频结尾与 Workspace 标签；断言操作行为而非组件布局内部状态。
- 跨 Project 父关系、无音频、重复保存、缺 Asset 和错误文件不得显示可成功比较。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- V1 可产生多个子版本，图与 provenance 可恢复，未保存 Candidate 不进入历史。
- 无需反复开文件即可比较两份 Version 音频，seek/regions 与播放失败有明确可执行行为。
- 确认预览与浏览器实现一致，完整创作路径以真实运行证据验收。

## Out of Scope

多人协作、Git 式音乐合并、自动声音对齐/质量评分、完整非线性音频编辑。

## Further Notes

P5 增强建立于 P1 已保存的父关系；Graph 不要求预先引入独立图数据库。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
