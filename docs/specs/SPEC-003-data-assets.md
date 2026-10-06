# SPEC-003: Data & Asset Model

状态：已确认并发布到 [#3](https://github.com/CaiZongyuan/llm-music/issues/3)。阶段：P1，P3/P5 按消费扩展。

## Problem Statement

生成文件若留在 Runtime 临时目录，清理或替换 Runtime 会破坏创作者项目；任务、候选结果和已保存版本也容易混为一谈。

## Solution

以 Project 组织独立 Asset、Score、Job、Candidate 和不可覆盖的已保存 Version，由应用校验与导入实际文件，保留来源和父版本关系。

## User Stories

1. As a music creator, I want to store files as Project Assets, so that runtime cleanup does not remove my work.
2. As a music creator, I want to keep original reference audio, so that I can return to the source of a transcription.
3. As a music creator, I want to retrieve an ABC Score and derived MIDI, so that I can inspect and exchange notation.
4. As a music creator, I want to inspect unsaved Candidates, so that I can experiment without filling Version history.
5. As a music creator, I want to save a Candidate explicitly, so that the selected inputs and outputs remain linked.
6. As a music creator, I want to derive work from a parent Version, so that creative alternatives retain their origins.
7. As a music creator, I want to retain old saved inputs after editing, so that earlier Versions remain meaningful.
8. As a maintainer, I want to validate outputs before registration, so that incomplete files never appear as successful Assets.
9. As a maintainer, I want to recover from failed imports, so that database rows never claim missing results are complete.
10. As a maintainer, I want to reopen data after migration, so that schema evolution preserves existing projects.

## Implementation Decisions

- 数据库保存元数据与文件定位，不存储大型二进制 blob。Asset 可表示音频、ABC、MIDI、Image/PDF、tokens/latents 与 Runtime artifacts，但首版只实现实际消费者需要的读写。
- Runtime output 经过 validate/import 成为应用 Asset；Runtime 工作目录不作为永久业务 storage。导入失败时 Job 不得 completed，重试导入不能重复创建同一结果。
- Score 的首版 source representation 为 ABC，MIDI 为交换/试听派生格式。Score 是可独立引用的创作对象，不只是 Job 返回字符串。
- Candidate 表示可检查但未明确保存的结果；Version 由创作者明确保存，快照关联输入、Score、音频、Job provenance 和可选 parent_version。
- 基础父版本关系从 P1 保留；同 Project 归属、父节点有效性与环约束由服务验证。版本图呈现和分支比较在 P5 提供。
- SQLite WAL、SQLAlchemy 2、Alembic 管理持久状态；迁移与文件导入失败必须有恢复行为。保存旧版本后编辑不得覆盖其输入和 Asset 内容。

## Testing Decisions

- 通过公开 API 上传、生成、保存和重启读取，确认元数据与真实文件一致；直接删除 Runtime 临时输出后，应用 Asset 仍可读取。
- 以损坏输出、重复导入、失败存储及跨 Project 引用验证错误；检查不能产生成功但无文件的持久结果。
- 数据库迁移使用真实临时 SQLite；从前一受支持 schema 升级后重走项目/素材/版本读取。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- 应用长期持有素材，Runtime 清理不破坏项目与 Version。
- 未保存 Candidate 不进入 Version 历史；保存后输入输出及 provenance 可恢复。
- 失败导入和迁移有确定结果，不暴露已注册但不可访问的成功产物。

## Out of Scope

协同编辑、全量媒体编辑器、主动构建所有未来 artifact 的专用 UI、未经请求的删除/垃圾回收策略。

## Further Notes

遵循已有 GLOSSARY 的 Candidate/Version 定义；素材原始内容和已保存 Version 不随编辑草稿覆盖。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
