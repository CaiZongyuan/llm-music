# SPEC-008: Generation Experience

状态：已确认并发布到 [#8](https://github.com/CaiZongyuan/llm-music/issues/8)。阶段：P0 验证，P1 API，P2 Web；P4 Cover。

## Problem Statement

创作者需要从风格与歌词生成可试听的音频和可检查 Score，并在保存前判断候选结果是否值得保留。

## Solution

Generate 返回关联 Audio/Score 的 Candidate，经检查试听后显式保存 Version；Cover 延续可见 Score 检查步骤，在 P4 增加已验证的 melody/full 模式。

## User Stories

1. As a music creator, I want to submit style and lyrics, so that I can generate music from creative intent.
2. As a music creator, I want to use recorded generation settings, so that I can understand the conditions of a result.
3. As a music creator, I want to see planning, synthesis and saving phases, so that I can understand ongoing work.
4. As a music creator, I want to listen to generated audio, so that I can evaluate the Candidate before saving.
5. As a music creator, I want to inspect the planned Score, so that I can see the musical representation behind the audio.
6. As a music creator, I want to explicitly save a Candidate, so that only selected work becomes a Version.
7. As a music creator, I want to edit inputs and generate another Candidate, so that I can explore another creative direction.
8. As a music creator, I want to retain previous saved results, so that new experiments do not overwrite past work.
9. As a music creator, I want to inspect a transcribed Score before Cover, so that I can control the intermediate musical content.
10. As a music creator, I want to choose melody or full Cover with clear explanations, so that I understand the supported mode.
11. As a music creator, I want to recover after a failed or cancelled run, so that my inputs remain available.
12. As a maintainer, I want to trace each Candidate to model and workflow revisions, so that I can compare and diagnose results.

## Implementation Decisions

- Generate 的输入为 style、lyrics 与明确的运行设置，输出至少包含可播放 Audio 与 Score Candidate；约 30–40 秒为 P0 已验证短片段基线，不推定更长输入已支持。
- 用户只看到领域 Job、phase、结果与错误；参数/provenance 可追溯但节点不进入主产品流程。
- 候选结果与保存 Version 分离。失败或取消不自动生成 Version；显式保存记录当前选定结果及输入快照，重复提交保存须有确定结果。
- P3 从编辑 Score 生成采用独立 GenerateFromScore operation。P4 Cover 是 Reference Audio→Transcribe→Inspect/Edit Score→new style→Generate→Candidate→Save，保留中间成果。
- P4 明确提供 melody/full 选择与解释；文案、输入映射和支持条件来自锁定插件实际语义与样本验证，不自行发明两个模式的技术含义。
- 音频 Player 在 Workspace 持续存在；切换 Score/lyrics/Versions 可继续试听。

## Testing Decisions

- 从公开 API 和真实浏览器验证 style/lyrics→Job→Audio/Score→显式 Version；确认未保存 Candidate 不属于 Version 列表。
- 覆盖 OOM、缺模型、无效 Workflow、取消、输出损坏、保存失败和刷新；确认已有 Version 的内容不受新任务影响。
- P4 真实样本分别验证 melody/full、保留可检查 Score 和模式 provenance；fake 模式不替代可用性证明。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- P1/P2 完成生成、试听/检查、显式保存和重启/刷新恢复。
- P4 Cover 保留中间 Score，两种模式有正确解释、映射和真实结果。
- 运行失败能保留输入并给出领域错误，Version 不被新实验覆盖。

## Out of Scope

长曲稳定性承诺、P6 高阶能力、自动保存所有生成结果、黑盒 Cover。

## Further Notes

P4 票据须独立确认 Cover 交互；模式缺 capability 时明确拒绝，不悄悄改用另一模式。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
