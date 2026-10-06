# SPEC-001: Runtime Validation

状态：已确认并发布到 [#1](https://github.com/CaiZongyuan/llm-music/issues/1)。阶段：P0。

## Problem Statement

开发者尚不知道 RTX 3070 Ti Laptop 8GB 能否连续、稳定地完成 YuE2 生成和 SheetSage2 转谱。只成功生成一次不足以支持正式产品开发。

## Solution

提供锁定环境、单命令 Doctor 和无需 Canvas 的 API 验证路径，实际运行固定输入、串行排队、取消、重复任务及清理，产出可以复查的 P0 结论。

## User Stories

1. As a runtime developer, I want to recreate a pinned environment, so that another run uses the same software and weights.
2. As a runtime developer, I want to check GPU and model readiness with one command, so that I can fix prerequisites before inference.
3. As a runtime developer, I want to transcribe a fixed short audio sample through API mode, so that I can inspect valid ABC and MIDI.
4. As a runtime developer, I want to generate 30–40 seconds from fixed style, lyrics and seed, so that I can evaluate playable output.
5. As a runtime developer, I want to start with BF16 and offload, so that I can establish a stable baseline before changing settings.
6. As a runtime developer, I want to compare low_vram only when the baseline runs out of memory, so that I can explain the effect of one changed setting.
7. As a runtime developer, I want to submit several jobs to a serial GPU queue, so that jobs cannot compete for 8GB of VRAM.
8. As a runtime developer, I want to cancel a queued request, so that unwanted work never starts.
9. As a runtime developer, I want to cancel only the running request I own, so that another request is never interrupted.
10. As a runtime developer, I want to run ten consecutive jobs and inspect cleanup, so that I can detect memory growth and stale state.
11. As a maintainer, I want to read timings, memory, logs and limitations, so that I can decide whether to enter product development.
12. As a maintainer, I want to see failed prerequisites reported as unverified, so that a simulated result cannot pass the GPU gate.

## Implementation Decisions

- P0 仅建立验证工具和必要 Runtime 边界，不提前搭建正式 FastAPI 产品服务或 Web。ComfyUI 与自定义节点使用独立 uv 项目、环境和锁；记录 Python、Torch、CUDA、驱动、提交、模型 revision/hash 与代码/权重许可。
- Doctor 检查 GPU/VRAM、Torch CUDA、ComfyUI import、自定义节点、必需模型、磁盘和端口；成功与失败均有可读结果和机器可判断的退出状态。模型准备可独立复用已有本地权重，不强制每次下载。
- 初始条件为 offload=true、low_vram=false、keep_model_loaded=false、cot=full、约 30–40 秒；使用插件推荐且稳定的 attention。只有基线 OOM 后才单独切换 low_vram，并保留两组事实。
- 通过版本化 Workflow 和公开 Runtime API 执行固定转谱与生成输入；保存原始请求摘要、输入 hash、输出校验与 provenance。不用 Canvas 手工操作代替验收。
- 单 GPU inference concurrency=1。运行中取消前核验目标与当前 Runtime Job 的对应关系；取消排队任务只移除目标。取消或失败后下一项必须仍可执行。
- 重复测试默认连续 10 项，满足规划的 5–10 项范围。逐项记录 VRAM/RAM、加载与各阶段时间、总耗时、音频实际时长和 RTF；区分设备总内存、进程内存、冷启动与重复运行。无法观测的指标明确为 unavailable。
- P0 gate 需要转谱、生成、queue、cancel、history、repeat、cleanup 全部有真实目标 GPU 证据。失败或缺失证据时保留未通过结论；允许继续整理规划，不进入正式产品实施。

## Testing Decisions

- 最高验证入口为 Doctor 命令和 Runtime 的公开 API。成功标准包括 ABC 可解析、MIDI 可读取、音频可解码且可试听，不以文件存在或 HTTP 200 代替正确输出。
- 验证排队顺序、不同任务归属、取消竞态、history 结果、重复任务和清理后的后续推理。Fake Runtime 可验证工具逻辑，但不能提供 P0 通过证据。
- 基准报告保留输入、条件、计量范围和逐次结果；不采用社区数字作为本机验收值，不承诺尚未测量的延迟或质量门槛。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- 在目标 GPU 上 API 转谱得到有效 ABC/MIDI，API 生成得到约 30–40 秒可播放音频。
- 多项严格串行，排队/运行取消安全，连续 10 项与清理验证有真实日志和输出。
- runtime-report、benchmark、日志和 known limitations 可追溯到完整版本及设置，结论明确决定 P1 是否解锁。

## Out of Scope

正式 Web、完整 Project 数据库、Native Runtime 重写、量化/attention/采样等多变量调优、GPU CI、长期高阶音乐能力。

## Further Notes

当前没有任何真实 GPU 验证证据。选择运行版本、合法固定样本和实际稳定设置属于实施工作，不能在规划中虚构其值。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
