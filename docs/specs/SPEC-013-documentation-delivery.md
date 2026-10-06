# SPEC-013: Documentation & Developer Entry Points

状态：已确认并发布到 [#13](https://github.com/CaiZongyuan/llm-music/issues/13)。阶段：P0 维护记录，P1 起按实装发布。

## Problem Statement

开发者与使用者需要按实际版本运行音乐工作台；复制维护的示例与参考会落后于代码，只有规划文字不能帮助读者完成真实任务。

## Solution

按实际已实现阶段交付中英文任务型文档，采用 Astro/Starlight、单一章节清单和源码/API/配置生成流程，经检查后发布到 GitHub Pages。

## User Stories

1. As a new developer, I want to follow a runnable introduction, so that I can obtain the first verified result.
2. As a experienced developer, I want to use quick start and architecture entry points, so that I can navigate the project efficiently.
3. As a music creator, I want to follow guides for implemented workflows, so that I can complete supported tasks.
4. As a reader, I want to use one music Project across tutorial chapters, so that each chapter builds on the previous result.
5. As a reader, I want to see prerequisites and one failure recovery per tutorial, so that I can recover when a step fails.
6. As a reader, I want to switch between equivalent Chinese and English pages, so that I can use my preferred language.
7. As a reader, I want to search and navigate related topics, so that I can find the next useful operation.
8. As a developer, I want to read examples imported from versioned source, so that documentation code matches implemented code.
9. As a client developer, I want to read generated API and configuration references, so that defaults, errors and limitations stay accurate.
10. As a maintainer, I want to validate sources, links and final HTML before release, so that the published site is navigable.
11. As a reader, I want to see the source version of a deployed page, so that I know which implementation it describes.
12. As a maintainer, I want to publish the validated main-branch artifact, so that the live site matches checked documentation.

## Implementation Decisions

- Astro + Starlight，发布 GitHub Pages；正文只描述已实现行为，计划、工单过程和隔离预览按用途保留。文档站不计作 P2 前的正式产品 Web。
- Markdown/MDX 正文为唯一来源，章节清单登记 stable id/type/group/language titles/source/publish paths；只有登记页公开发布。
- 同章节中英文语义、前提和失败边界对应，previous/next 与语言映射和侧栏同源；未指定链路时关闭自动串联。
- 教学代码由完整受控源码引入，仓库文档链接解析为同语言站内链接，源码链接定位到对应 GitHub commit；页面显示源码版本与正文来源。
- API 与 client 共用 FastAPI/Pydantic 导出的 OpenAPI；配置参考来自真实 Settings metadata。生成过程不加载模型、不要求 GPU，生成页、缓存与构建产物不入 Git。
- 提供根级 pnpm docs:dev/docs:check/docs:build；检查章节唯一性、路径/源码存在、语言配对、导航、生成参考、内部链接/锚点/资源和 Pages base。
- 文档可见体验先给可运行预览并记录确认，实施后浏览器核对导航、语言、搜索、主题及子路径；主分支通过 CI 后发布同一已验证 artifact，并读回在线版本。

## Testing Decisions

- 用真实受控教程源码执行适用阶段的完整用户路径并验证结果/失败恢复，不能仅证明示例能编译。
- 无 GPU 运行生成、契约一致性、静态构建和产物检查；用真实浏览器检查章节导航、语言、搜索、主题和 Pages 子路径。
- 发布后读取实际页面与源码版本，确认 main CI 验证的 artifact 与线上版本相同；没有部署记录时只报告本地构建完成。
- 良好测试只断言公开行为与可读取的结果，不耦合内部类、节点布局或方法调用次数。当前仓库只有规划/术语，没有既有测试或 harness；首个对应票据建立可复用验证入口。

验收条件：

- 三类入口、连续教程、中英文页面、来源生成与 docs 命令可运行且覆盖当前功能。
- 示例操作、引用/导航/产物检查和真实浏览器体验通过。
- GitHub Pages 在线地址与构建源码版本可核验，计划页不会被当作已实现功能发布。

## Out of Scope

把维护过程全部公开为用户文档、GPU 依赖的 docs build、复制 API 类型/默认值、尚未实现 P6/P7 的操作教程。

## Further Notes

本规格补充 production 建议的 12 份规格，以落实用户给出的仓库在线文档要求；每张功能票据仍须同步更新相关代码、测试与文档。

实施影响：当前没有产品源码或数据库需要迁移；从首条真实路径建立模块，后续共享合同/持久状态变更须追踪实际消费者并保持已交付路径可用。普通 CI 使用无 GPU 测试；真实 Runtime 和 E2E 证据单独记录。所有未来阶段的计划仅表示规划，阶段 gate 通过前不调度实施。
