# SPEC-006: Web Application Architecture

状态：已确认并发布到 [#6](https://github.com/CaiZongyuan/llm-music/issues/6)。阶段：P2。

## Problem Statement

创作者需要在一个持续的 Project Workspace 完成音乐操作，而不是在多个孤立工具页之间管理文件。

## Solution

P1 验收后交付桌面 Web Library、Workspace、Jobs、Runtime 与 Settings，统一连接 FastAPI，保持播放器和可恢复 server state。

## User Stories

1. As a music creator, I want to browse a Project Library, so that I can reopen previous work.
2. As a music creator, I want to create and open a Project, so that I have one place for Assets, Jobs and Versions.
3. As a music creator, I want to upload audio in the Workspace, so that I can start a reference-based workflow.
4. As a music creator, I want to switch between Score, lyrics and Versions, so that I can keep listening while inspecting work.
5. As a music creator, I want to see empty, loading and failed states, so that I know what to do next.
6. As a music creator, I want to refresh the browser and recover server data, so that navigation does not erase saved work.
7. As a music creator, I want to see runtime readiness before submitting, so that I can fix missing prerequisites.
8. As a music creator, I want to use a clear isolated preview, so that I can review interactions without writing real project data.
9. As a client developer, I want to use a generated API client, so that UI requests follow the backend contract.
10. As a developer, I want to launch separate API, runtime and Web processes together, so that local development is reproducible.

## Implementation Decisions

- 正式 Web 从 P2 开始，采用 React/TypeScript/Vite、TanStack Router file-based routing、TanStack Query；Zod、shadcn/base ui、Tailwind 按实际功能选用。
- Web 只连接 FastAPI 的 HTTP/WS。TanStack Query 管理 Project/Job/Asset/Version/health 等 server state；复杂编辑本地状态出现时才考虑 Zustand。
- 先提供可运行、关键操作可执行且数据隔离的交互预览，覆盖空/加载/失败；记录确认和后续纠正后实施，并在真实浏览器对照验证。
- Library/Project Workspace 为中心，Generate/Transcribe/Score/Compare 属于项目上下文；Jobs、Runtime、Settings 使用同一应用数据和错误模型。
- 持续播放器使用 wavesurfer.js，提供播放、seek 和 regions；可用的 A/B 在 P5 实施。abcjs 在 Score 流程中承担谱面和播放能力。
- JS 使用 pnpm；客户端由 Pydantic/OpenAPI 生成。开发启动编排三个独立进程，记录端口与 owner，复用已运行的本项目服务，退出仅清理本次拥有的进程。
- UI 对未知真实进度使用 indeterminate；刷新和断联通过 HTTP 重新获取服务端数据，播放器的临时播放位置不作为持久创作对象。

## Testing Decisions

- 最高 seam 为真实浏览器经生成 client 访问 FastAPI；日常可用 Fake Runtime，真实 GPU E2E 在阶段验收执行且明确标记。
- 浏览器验证导航、错误恢复、上传、持续播放器和刷新；保存 Project/Asset/Version/Job 后按服务端 id 断言恢复。
- 预览与产品运行分别校验，确认预览无真实写入；真实浏览器对照已确认版本。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- 浏览器可用的 Library/Workspace/Jobs/Runtime，关键空、加载、失败均能恢复。
- 所有业务通信经 FastAPI，客户端来自现有合同，刷新恢复四类持久对象。
- 启动/停止可复现且不误停共享服务，正式界面与确认预览一致。

## Out of Scope

P0/P1 正式 Web、移动端、Electron packaging、第二套客户端、完整 DAW、复制 server state 的全局 store。

## Further Notes

等待 P1 gate；这里只约束 Web 架构和经验要求，具体用户路径由 SPEC-007/008/009/010/011/012 定义。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
