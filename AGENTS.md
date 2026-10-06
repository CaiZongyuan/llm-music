# 项目协作

开发与规划前阅读 [docs/production.md](docs/production.md)，遵循其范围、架构、阶段与验收标准。

## 开发

- P0 通过真实 GPU 验证后进入正式产品开发；正式 Web 在 P2 开始。
- JS 使用 pnpm；FastAPI 与 ComfyUI 使用独立的 uv 项目、环境和锁文件。
- 代码、测试与文档同步交付，报告实际验证结果。

## 效果预览

- 页面、交互和用户可见流程改动前，交付可运行的交互预览，关键操作可执行，覆盖相关空、加载与失败状态；模拟数据与真实写入隔离。
- 预览保留在 `docs/previews/`，反馈与确认记录在 `docs/ui/`。复用已确认版本与最新纠正；用户明确跳过再次预览时遵从该指示。实现后在真实浏览器中对照验证。

## 在线文档

- 使用 Astro + Starlight，发布到 GitHub Pages。
- 修改正文、导航、教程示例或生成参考前，阅读 [文档维护规范](docs/agents/documentation.md)。

## Agent skills

- 规格与票据使用 GitHub Issues；发布、依赖和领取规则见 [追踪器配置](docs/agents/issue-tracker.md)。
- 分流使用默认标签，映射见 [分流标签](docs/agents/triage-labels.md)。
- 探索领域前阅读 [领域文档入口](docs/agents/domain.md)。
