# SPEC-012: Runtime Diagnostics

状态：已确认并发布到 [#12](https://github.com/CaiZongyuan/llm-music/issues/12)。阶段：P0 命令，P1 API，P2 Web。

## Problem Statement

本地 8GB GPU 资源紧张，开发者和创作者需要知道模型、Runtime 与队列是否就绪，以及失败来自什么条件。

## Solution

从 P0 收集版本、内存与计时，P1 经应用提供 health/capabilities/models/queue/diagnostics，P2 用简洁 Runtime 页面呈现行动所需信息。

## User Stories

1. As a runtime developer, I want to inspect GPU, driver, Torch and CUDA facts, so that I can explain environment differences.
2. As a runtime developer, I want to record peak VRAM and RAM, so that I can evaluate resource feasibility.
3. As a runtime developer, I want to record load and inference phase timing, so that I can locate expensive work.
4. As a maintainer, I want to calculate RTF from actual output duration, so that I can compare measured runs.
5. As a music creator, I want to see backend and runtime health, so that I know why a request cannot start.
6. As a music creator, I want to see required model status, so that I can resolve missing or invalid weights.
7. As a music creator, I want to see the queue and current application Job, so that I understand GPU occupancy.
8. As a music creator, I want to see loaded models and memory when observable, so that I can understand resource pressure.
9. As a maintainer, I want to inspect model revisions and licenses, so that I can trace capability prerequisites.
10. As a music creator, I want to distinguish stale and unavailable telemetry, so that I do not mistake old metrics for current readiness.

## Implementation Decisions

- 从 P0 保留环境事实、Runtime/plugin/model revision、peak VRAM/RAM、load/planning/semantic/synthesis/VAE/total timing、实际输出时长与 RTF。
- 测量区分冷启动、缓存/加载状态、设备总值与进程值，并保留逐次结果。无法取得阶段计时/内存时记录 unavailable，不编造零值或估计值。
- RTF = 本次生成秒数 / 本次输出音频秒数；输入与模式不同的运行不直接作为性能优化结论。社区显存数据只作参考。
- P1 由 FastAPI 公开 backend/runtime health、capability、Model Registry 状态和应用 Job 队列摘要；P2 浏览器只从 FastAPI 获取。
- 模型状态 missing/downloading/ready/invalid 包含 hash/revision 校验事实和更新时间；过期诊断标明 stale，Runtime 失联不能继续显示 ready。
- Runtime 页面展示 GPU/VRAM、版本、loaded models、model status、queue/current Job 与 backend health；开发 traceback 留日志，产品先显示领域错误和恢复动作。

## Testing Decisions

- P0 命令输出与原始测量证据对应；测试 RTF 用实际有效 duration，缺数据不能得出性能结论。
- P1 HTTP seam 覆盖 ready、缺模型/无 GPU、invalid hash、Runtime 不可达和旧 telemetry；P2 浏览器验证状态/错误/刷新。
- 真实 GPU 取样校验读数的目标、单位和范围，fake telemetry 仅用于展示行为。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- 每个真实测试结果具备可追溯版本、设置、输出时长和测量范围。
- 应用 API 与 Web 可区分 backend/runtime/model/queue 状态及失联/过期事实。
- 错误可指导下一步，详细日志可诊断原因，GPU 读取失败不损坏普通业务 API。

## Out of Scope

远程监控服务、性能数字承诺、复杂自动调参、P7 Runtime 替换。

## Further Notes

测量用于决策，不把没有来源的显存/时间字段作为 ready 依据；复用 P0 已建立的 Model Registry 和 telemetry。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
