# SPEC-010: Job & Progress System

状态：已确认并发布到 [#10](https://github.com/CaiZongyuan/llm-music/issues/10)。阶段：P0 Runtime 行为，P1 应用生命周期，P2 Monitor。

## Problem Statement

创作者需要知道任务是否真实运行，并在取消、断联或重启后找回可靠结果，不能依赖假的百分比或永久 running。

## Solution

持久 Application Job 生命周期，通过领域事件实时更新，HTTP 状态负责恢复，对 Runtime 状态进行安全对账。

## User Stories

1. As a music creator, I want to distinguish queued and running Jobs, so that I know whether GPU work has started.
2. As a music creator, I want to see a meaningful phase, so that I can understand current activity.
3. As a music creator, I want to see progress only when measured, so that I am not misled by invented percentages.
4. As a music creator, I want to see indeterminate progress when necessary, so that the UI remains honest about uncertainty.
5. As a music creator, I want to cancel a queued or running Job, so that I control unwanted work safely.
6. As a music creator, I want to recover state after WebSocket loss, so that event delivery is not my only source of truth.
7. As a music creator, I want to recover Jobs after API restart, so that completed work does not become permanently running.
8. As a music creator, I want to get a meaningful terminal error, so that I can decide how to recover.
9. As a maintainer, I want to inspect runtime mappings and timing logs, so that I can diagnose stalled Jobs.
10. As a maintainer, I want to reconcile unknown runtime state without resubmission, so that one request never becomes duplicated GPU work.
11. As a music creator, I want to retry a failed operation explicitly, so that a new attempt has a separate Job identity.

## Implementation Decisions

- 公开 Job 状态仅 queued、running、completed、failed、cancelled。phase 描述 preparing/loading_model/transcribing/planning_score/generating_semantic/synthesizing/decoding_audio/saving；按真实证据更新。
- 可靠 progress 范围 0–1；无法计算时 null，phase 不转换成虚假百分比。completed 只有产物验证、导入和持久关联完成后产生。
- FastAPI WebSocket 发送领域事件，HTTP Job 查询为恢复来源；重连/重复事件不能倒退终态或重复导入结果。
- FastAPI 启动对 queued/running 查询 Runtime queue/history，恢复已确认的排队、运行、完成、失败或取消；不因 API 重启再次 submit。
- 生产规划中的 unknown 是对账结果，不引入第六种公开 Job 状态。暂时不确定时暴露恢复标识与可读原因，进行有界重试；超出记录在配置中的确认窗口后，以 failed/runtime_unavailable 和未确认原因结束，不能伪称成功或永久 running。保留原 Runtime 映射供后续诊断。
- 取消需区分排队与运行，并核验 Runtime ownership；竞态以查询到的真实最终状态为准。显式重试创建新的 Job，不悄悄覆盖原任务 provenance。

## Testing Decisions

- 通过 HTTP/WS 与可控 Fake Runtime 覆盖全生命周期、null progress、失败、重复/乱序事件、重连和不同任务的取消归属。
- 使用真实 SQLite 持久映射，关闭并重启 API，分别模拟 Runtime queued/running/history completed、缺历史和不可达；断言不重复 submit，确认窗口有界。
- 实际 Runtime integration 验证 queue/history/interrupt 语义；真实浏览器断联/刷新后重新取 HTTP 状态并恢复 Monitor。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- 五种公开状态与真实 phase/progress 一致，产物保存前不会 completed。
- 取消安全，HTTP/WS 恢复一致；API 重启不重复执行，未知状态有界处理。
- Job 日志可回答模型、workflow、参数、耗时、内存和失败原因。

## Out of Scope

分布式队列、多 GPU concurrency、虚假 ETA、由 WebSocket 充当唯一持久状态。

## Further Notes

unknown 的歧义按既有五态契约处理；确认窗口值由 Runtime 实测与本地恢复策略确定并测试，不在规划阶段虚构超时值。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
