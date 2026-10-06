# SPEC-002: FastAPI Application Core

状态：已确认并发布到 [#2](https://github.com/CaiZongyuan/llm-music/issues/2)。阶段：P1。

## Problem Statement

音乐创作者需要保存项目、素材与创作结果，并通过统一应用入口进行转谱和生成，而不是管理 Runtime 的文件与节点。

## Solution

P0 通过后提供本地 FastAPI 应用，通过 HTTP/Swagger 完成 Project、Asset、Job、Candidate 和显式保存 Version 的完整闭环。

## User Stories

1. As a music creator, I want to create and reopen a Project, so that my work has a persistent home.
2. As a music creator, I want to upload reference audio into a Project, so that I can start transcription.
3. As a music creator, I want to submit a Transcribe Job, so that I can retrieve ABC and MIDI from the application.
4. As a music creator, I want to generate with style and lyrics, so that I can inspect audio and Score together.
5. As a music creator, I want to inspect a Candidate before saving, so that experiments do not automatically become Versions.
6. As a music creator, I want to explicitly save a Candidate as a Version, so that my selected result remains available.
7. As a music creator, I want to list Assets and Jobs in their Project, so that I can understand previous work.
8. As a music creator, I want to reopen persisted data after restart, so that service restarts do not erase my work.
9. As a client developer, I want to generate a client from OpenAPI, so that Python and TypeScript agree on the contract.
10. As a maintainer, I want to start the API without CUDA dependencies, so that business services remain independent of the GPU environment.

## Implementation Decisions

- FastAPI 是唯一应用后端；Project、Asset、Version、Job 的业务 owner 是应用。服务仅通过 InferenceRuntime 操作推理。
- FastAPI 使用独立 uv 项目/环境/lock，与 ComfyUI 进程隔离；使用 SQLite WAL、SQLAlchemy 2、Alembic。默认仅绑定 127.0.0.1。
- Pydantic 为 API 唯一来源，输出 OpenAPI 以生成 TypeScript client。按真实已实现接口扩展合同，不先复制全部未来类型。
- P1 第一条路径为创建 Project、上传 Audio、提交 Transcribe、查询 Job、获取 ABC/MIDI；第二条为 Generate、获取 Audio/Score Candidate、显式创建 Version。
- 应用层统一输入校验、资源归属、错误响应与结构化日志；开发错误细节进入日志。持久对象引用和输出结果以应用 id 对外公开。
- FakeInferenceRuntime 从 P1 起支持无 GPU 的集成开发；真实 Runtime 和 fake 模式可识别且数据目录隔离。

## Testing Decisions

- 主要 seam 为 FastAPI HTTP/WS 公共接口，使用临时 SQLite、独立素材存储和 FakeInferenceRuntime；验证请求到持久结果，而非服务方法调用。
- 真实 Runtime smoke 重走两条 P1 路径，实际校验音频、Score 与重启后引用；GPU 检查在本地验收而非普通 CI。
- 合同导出、生成客户端与数据库迁移可在无 CUDA/GPU 环境完成；生成行为由接口测试和客户端类型检查确认。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- 只通过 FastAPI/Swagger 完成两条 P1 路径，Candidate 与 Version 语义一致。
- 持久对象重启可读，API 环境不导入 Torch/CUDA，生成客户端匹配当前 OpenAPI。
- P1 fake 集成和真实 smoke 结果分别报告后进入 P2。

## Out of Scope

P1 正式 Web、用户鉴权、多用户、PostgreSQL、直接暴露 ComfyUI。

## Further Notes

等待 SPEC-001 的真实 P0 gate；SPEC-003/004/005/010/012 共同约束行为，票据按完整操作闭环实现它们。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
