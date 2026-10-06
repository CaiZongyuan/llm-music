# SPEC-004: ComfyUI Runtime Adapter

状态：已确认并发布到 [#4](https://github.com/CaiZongyuan/llm-music/issues/4)。阶段：P0 验证边界，P1 产品接入。

## Problem Statement

应用若直接操作 node、prompt 和 Runtime JSON，将无法可靠跟踪取消、恢复和结果，也难以替换 Runtime。

## Solution

由统一 InferenceRuntime 隐藏 ComfyUI 细节，用应用级请求、状态、事件和产物描述支持转谱与生成。

## User Stories

1. As a application developer, I want to submit domain operations through one runtime interface, so that business code stays independent of ComfyUI.
2. As a application developer, I want to query health and capabilities, so that unsupported work is rejected before submission.
3. As a music creator, I want to see only my application Job id, so that runtime implementation details do not interrupt creation.
4. As a music creator, I want to receive meaningful phases, so that I can understand ongoing work.
5. As a music creator, I want to cancel a queued Job, so that other queued work remains intact.
6. As a music creator, I want to cancel my running Job safely, so that another active request is never interrupted.
7. As a music creator, I want to retrieve completed results after event loss, so that I can recover work through history.
8. As a maintainer, I want to map runtime failures to domain errors, so that users get actionable messages.
9. As a application developer, I want to use a fake runtime under the same contract, so that development does not require daily GPU inference.
10. As a maintainer, I want to recover when runtime state is uncertain, so that an application restart never silently resubmits work.

## Implementation Decisions

- InferenceRuntime 暴露 health、capabilities、submit、status、subscribe、cancel、result；业务模块仅依赖该边界。只实现当前 ComfyUIRuntime 与测试 FakeInferenceRuntime。
- Application Job 与 Runtime Job 独立标识，映射持久保存；Runtime prompt/node ids 不进入用户业务 API、UI 或事件正文。
- Adapter 负责调用 Runtime HTTP/WS、Workflow input/output mapping、domain phase/error 转换和结果描述；应用存储负责最终 Asset 导入。
- Runtime concurrency=1。调用全局 interrupt 前，确认当前任务确实是请求取消的 Runtime Job；映射不明时拒绝中断并记录原因。
- 订阅丢失后通过 queue/history 补查，运行状态与历史输出保留可核验依据。模糊状态采用 SPEC-010 的有界对账策略，不盲目再次 submit。
- 错误使用 runtime_out_of_memory、model_missing、workflow_invalid、runtime_unavailable、cancelled、transcription_failed、generation_failed 等领域含义；细节保留在开发日志。

## Testing Decisions

- 主要通过应用 HTTP/WS 行为验证替代 fake/real 实现的可观察一致性；Runtime 集成以公开 ComfyUI API 验证实际提交、history、队列和取消语义。
- 覆盖错误 task ownership、queued-to-running 竞态、重复事件、断联和遗漏完成事件；确保其他任务不被取消且结果可恢复。
- Fake Runtime 支持成功、失败、取消、未知进度与断联场景；fake 输出不得用于真实显存、速度或质量结论。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- 业务操作与事件不依赖 node/prompt JSON，fake 与 real 可从统一边界使用。
- 取消只能作用目标任务，遗漏事件后能通过查询得到真实状态和结果。
- 产品错误可读，开发细节能从 Job 日志追溯。

## Out of Scope

NativeYuE2Runtime、AudioCppRuntime、多 Runtime 同时调度、多 GPU worker、暴露 Canvas。

## Further Notes

原始 Runtime API 与版本能力在 P0 固定，并在产品接入时复用已验证事实；不为未采用 Runtime 创建实现。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
