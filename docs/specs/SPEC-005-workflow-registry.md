# SPEC-005: Workflow Registry

状态：已确认并发布到 [#5](https://github.com/CaiZongyuan/llm-music/issues/5)。阶段：P0 固定 workflows，P1 registry，P3/P4 扩展。

## Problem Statement

没有版本化输入输出映射的 Workflow 会令结果无法复现，并把节点细节散入业务代码。

## Solution

将业务 operation 映射到已验证、版本化的 Workflow，登记模型和 capability 前提，随 Job 保存完整运行来源。

## User Stories

1. As a music creator, I want to request Transcribe by its domain name, so that I do not need to choose a JSON workflow.
2. As a music creator, I want to request Generate with style and lyrics, so that the application selects a compatible workflow.
3. As a music creator, I want to generate from an edited Score, so that the saved ABC is the actual inference input.
4. As a music creator, I want to choose a supported Cover mode, so that the mode maps to a verified runtime capability.
5. As a maintainer, I want to pin workflow versions, so that past Jobs retain the definitions that produced them.
6. As a maintainer, I want to inspect required model revisions, so that missing or incompatible weights are detected early.
7. As a maintainer, I want to validate input and output mappings, so that node changes do not silently corrupt results.
8. As a maintainer, I want to record code and weight licenses separately, so that capability use remains traceable.
9. As a maintainer, I want to retrieve complete Job provenance, so that I can compare or diagnose two runs.
10. As a application developer, I want to change a workflow behind the registry, so that business APIs stay stable.

## Implementation Decisions

- Workflow definition 与 manifest 进入 Git；manifest 包含 logical id/version、application input mapping、runtime output mapping、required models/capabilities。
- 业务请求使用 Transcribe、Generate、GenerateFromScore、Cover；不得由用户指定或修改 node id。Workflow mapping 的具体节点仅归 registry/adapter。
- 每次 Job 固化 workflow id/version、Runtime/revision、plugin revision、model revision 与 settings，包括 seed 和显存策略；若信息无法确定，明确未知，不伪造。
- 轻量 Model Registry 覆盖 YuE2、YuE2 VAE、SheetSage2，记录 provider/repository/revision/file/hash/local path/size/state/license，区分代码与权重许可。
- 必需模型或 capability 未就绪时在提交前返回领域错误；模型状态为 missing、downloading、ready、invalid，具体下载/校验动作只随实际需求实现。
- P0 固定 Generate/Transcribe 后复用到 P1；GenerateFromScore 在 P3、Cover 在 P4 扩展。Cover 模式解释须核对锁定插件真实语义。

## Testing Decisions

- 从公共操作请求到输入快照和注册 Asset 验证映射，而非断言内部 JSON 数组顺序或硬编码节点。
- 使用固定 workflows 和可控 Runtime 结果覆盖缺模型、无 capability、损坏 workflow、输出缺失与 revision 变更；实际 mapping 在 GPU 集成中验证。
- 每个结果能反查完整 provenance；升级 registry 后历史 Job 的 revision 不被覆盖。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- 四类 operation 在各自阶段都有明确、验证过的映射和能力前提。
- 模型/Workflow 未就绪不会进入推理；成功结果保留完整版本和参数。
- Workflow 调整不要求业务层处理 node id。

## Out of Scope

任意用户 workflow 编辑器、全部社区模型自动下载、P6 capability 和未来 Native Runtime 实现。

## Further Notes

许可只记录事实及来源，不从代码许可推断模型权重许可；未知许可显式记录。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
