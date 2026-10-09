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

## 关于图像生成

- 使用 `imagegen` 的 CLI 模式，先读取用户目录 `.codex/skills/.system/imagegen/SKILL.md`。
- 从用户目录 `.codex/config.toml` 读取当前 `model_provider` 对应的配置：将 `base_url`、`experimental_bearer_token` 分别传入子进程的 `OPENAI_BASE_URL`、`OPENAI_API_KEY`。凭据仅放在内存和子进程环境中。
- 模型选型：精细生成用 `gpt-image-2.5-sunburst`；日常生成用 `gpt-image-2.5-flare`。
- 用项目 `.venv/Scripts/python.exe` 执行用户目录 `.codex/skills/.system/imagegen/scripts/image_gen.py generate`；通过 `--model`、`--prompt-file`、`--out` 指定模型、提示词文件和输出路径。
- 常用参数：`--size 1024x1024 --quality high --output-format png`；对比模型时使用相同提示词和参数，并加 `--no-augment`。
- 图片保存到 `output/imagegen/`，检查画面、文字和实际尺寸后报告路径。当前服务曾将 `1024x1024` 请求返回为 `1254x1254`，以实际文件为准。
