# 文档交互预览 v1 / Documentation preview v1

这是 [#28](https://github.com/CaiZongyuan/llm-music/issues/28) 的确认前预览。它只读取本目录中的静态文档内容，不连接 FastAPI 或 ComfyUI，不执行命令，不写入项目数据。尚未实现正式 Astro/Starlight 文档站或 GitHub Pages 发布。

This is the pre-confirmation preview for [#28](https://github.com/CaiZongyuan/llm-music/issues/28). It reads static documentation in this directory only. It connects to neither FastAPI nor ComfyUI, runs no commands, and writes no Project data. The formal Astro/Starlight site and GitHub Pages publication are not implemented yet.

## 运行 / Run

需要 Node.js，无需安装依赖。在仓库根目录执行：

Node.js is required. No dependency installation is needed. Run from the repository root:

```powershell
node docs/previews/documentation-v1/serve.mjs
```

打开 / Open: <http://127.0.0.1:18028/llm-music/docs-preview/#/zh/overview>

服务只绑定 `127.0.0.1`，只提供四个预览文件。用 Ctrl+C 停止。端口占用时选择自己的空闲端口：

The server binds to `127.0.0.1` and serves only four preview files. Press Ctrl+C to stop. If the port is occupied, choose your own free port:

```powershell
node docs/previews/documentation-v1/serve.mjs --port 18029
```

## 可操作内容 / Available interactions

- 三个任务入口、六个章节、侧栏与本页导航；明确的“快速开始 → Doctor → 第一条转谱结果”链路。
- 同章节中英文切换；浅色、深色、跟随系统；重新载入保留语言与主题选择。
- 本地搜索、关键词结果跳转、无结果后清空、失败后重试；Ctrl+K 和 Esc。
- 侧栏“预览搜索状态”可以保持加载状态、触发一次失败、恢复正常。模拟仅影响本预览。
- 复制 PowerShell 命令，查阅固定提交的正文与源码；复制不执行命令。
- 不存在章节的恢复入口，以及内容文件载入失败后的重试。

- Three task entrypoints, six chapters, sidebar, and page outline. An explicit “Quick start → Doctor → First transcription result” chapter chain.
- Same-chapter Chinese/English switching. Light, dark, and system themes. Language and theme preferences survive reload.
- Local search, result navigation, clearing an empty result, and retrying a failed search. Ctrl+K and Esc.
- “Preview search states” in the sidebar holds loading, triggers a failure, or restores normal search. Simulation affects this preview only.
- Copy PowerShell commands and read page/source links at a fixed commit. Copy never executes a command.
- Recovery for a missing chapter and retry after a content-file loading failure.

## 内容来源 / Content sources

代表性教程摘自提交 `236eee2ec2b7fc0ca66b53ebea5c679dec736190` 的双语 Runtime 指南。命令与当前受控源码一致。本预览的 `content.json` 是用于确认信息架构的静态样本；正式站的章节清单、源码引用与生成流水线待确认后实施。它不是已生成的 API 参考，也不是新的真实 GPU 执行证据。

Representative tutorials are selected from paired Runtime guides at commit `236eee2ec2b7fc0ca66b53ebea5c679dec736190`. Commands match controlled source. This preview's `content.json` is a static sample for information-architecture confirmation. The formal chapter manifest, source inclusion, and generation pipeline follow confirmation. It is neither generated API reference nor new real GPU evidence.

| 来源 / Source | 固定位置 / Pinned location |
| --- | --- |
| 准备、Doctor / Preparation, Doctor | `docs/guides/runtime-doctor.md`, `docs/guides/runtime-doctor.en.md`, `runtime/comfyui/manage.py` |
| 转谱 / Transcription | `docs/guides/runtime-transcription.md`, `docs/guides/runtime-transcription.en.md`, `runtime/comfyui/p0/transcribe.py` |
| 范围与架构 / Scope and architecture | `docs/production.md`, `docs/specs/SPEC-013-documentation-delivery.md`; 根目录 / root `GLOSSARY.md` |
| 版本 / Revisions | ComfyUI `7a5dad695fe1cae25efcb2550530fb20ef68da3d`; plugin `fc78df9dfb214f396aa281f5b03519cefff5b00a`; models `2f76ca75e6ee094169de899cc7fc99d6887e2196` |

实际交互验证与确认状态见 [记录](../../ui/28-documentation-preview.md)。

See the [record](../../ui/28-documentation-preview.md) for actual interaction validation and confirmation status.
