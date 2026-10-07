# 创作者文档预览 v2 / Creator documentation preview v2

[#65](https://github.com/CaiZongyuan/llm-music/issues/65) 的确认前内容预览。复用已确认 v1 的导航、双语、主题与搜索外观，把主线调整为使用方法与创作玩法。正式 Astro/Starlight 站的正文、章节清单、依赖及构建没有修改。

This is the pre-confirmation content preview for [#65](https://github.com/CaiZongyuan/llm-music/issues/65). It reuses the approved v1 navigation, bilingual shell, themes, and search appearance, with tutorials focused on use and creative experiments. It changes no formal Astro/Starlight content, manifest, dependencies, or build.

## 运行 / Run

需要 Node.js，无需安装依赖。在本 checkout 根目录执行：

Node.js is required; no dependency installation. Run at this checkout's root:

```powershell
node docs/previews/documentation-v2/serve.mjs
```

打开 / Open: <http://127.0.0.1:18030/llm-music/docs-usage-preview/#/zh/overview>

服务只绑定 `127.0.0.1`，仅接受 GET/HEAD，只提供明确列出的静态预览文件。按 Ctrl+C 停止；端口冲突时用 `--port <FREE_PORT>` 选择自己的端口。保留 `/llm-music/` 子路径，用于检查 Pages 导航形状；这不是 Pages 发布。

The server binds only to `127.0.0.1`, accepts GET/HEAD only, and serves allowlisted static preview files. Press Ctrl+C to stop; choose your own port with `--port <FREE_PORT>` if occupied. The `/llm-music/` subpath checks the shape of Pages navigation; this is not a Pages publication.

## 内容与交互 / Content and interactions

- 六个章节成对交付：创作概览、第一段音乐、参考音频转谱、风格/歌词/seed 玩法、准备与排障、当前能力与限制。
- 三份完整代表性教程给出输入选择、操作、试听/检查、一次失败恢复和下一种玩法。技术步骤放在可展开补充中，既有指南通过固定版本链接继续可达。
- 点击玩法配方可查看改动目的与完整可复制输入。选择只更新文档中的静态示例，不提交生成或保存。
- 播放和下载已有真实音乐样本；复制参数、歌词及命令。复制不执行命令。
- 同章节与小节语言切换、浅色/深色/系统主题及刷新记忆、侧栏与本页导航、教程前后章。
- 本地搜索、结果跳转、空结果清空、加载/失败/恢复，以及文档载入失败重试与缺失章节恢复。

- Six paired chapters: creator overview, first music, Reference Audio transcription, style/lyrics/seed ideas, preparation/help, and current scope.
- Three complete representative tutorials cover input selection, operations, listening/inspection, one failure recovery, and another experiment. Technical steps are expandable supplements. Existing guides remain accessible at a fixed revision.
- Recipe buttons show intent and complete copyable inputs. Selection changes only the static tutorial example; it submits no generation or save.
- Play/download a preserved real music sample; copy parameters, lyrics, and commands. Copying runs no command.
- Same-chapter/section language switching, light/dark/system themes with reload memory, sidebar/outline, and explicit chapter links.
- Local search, navigation, empty-result clearing, loading/failure/recovery, content-load retry, and missing-chapter recovery.

## 实际来源与隔离 / Sources and isolation

接口基线 `f02bd5310ea29845f1900a53271e71df30f5169b`。`content.json` 是确认教程方向的静态样本；链接指向真实双语应用指南和源码。公开生成参数与 CLI 来自 `services/api/src/music_api/generation_schemas.py` 和 `services/api/examples/generate_save.py`。转谱范围依据 `docs/guides/api-transcription{,.en}.md` 与已实现检查。

API baseline: `f02bd5310ea29845f1900a53271e71df30f5169b`. `content.json` is a static sample for tutorial-direction confirmation. Links point to actual paired guides and source. Public generation parameters and the CLI come from `services/api/src/music_api/generation_schemas.py` and `services/api/examples/generate_save.py`. Transcription profiles follow `docs/guides/api-transcription{,.en}.md` and implemented checks.

`sample-pr58.mp3` 是用户已试听的真实 G35 历史压缩副本，561068 B；SHA256 为 `6c36d74e20f235af77fd60e262ed5533d033c907dc3a3e09aa23ec18b8ca4c4e`。第一章的风格、歌词与 seed 对应这次实际已验证输入；完整来源见 `sample-provenance.json`。其他玩法明确为未调试、未试听的灵感建议，不代表模型效果验证。

`sample-pr58.mp3` is the historical real G35 listening copy already auditioned by the user: 561068 B, SHA256 `6c36d74e20f235af77fd60e262ed5533d033c907dc3a3e09aa23ec18b8ca4c4e`. The first chapter matches that run's recorded style, lyrics, and seed; see `sample-provenance.json`. Other recipes are explicitly untuned, unauditioned inspiration, not verified model outcomes.

预览不连接 FastAPI 或 Runtime，不上传素材，不执行推理，不写入 Project/Candidate/Version。只读静态文件，语言和主题偏好仅写入预览自己的 localStorage namespace。当前操作入口仍是 API/CLI，正式 Workbench Web、内置曲谱编辑、Cover、A/B 与长曲没有被当作现有功能。

The preview connects to neither FastAPI nor Runtime, uploads no Assets, runs no inference, and writes no Project/Candidate/Version. It reads static files. Language/theme preferences use the preview's own localStorage namespace. Actual entrypoints remain API/CLI. The product Web Workbench, integrated score editor, Cover, A/B, and long-song support are not presented as available.

反馈与实际浏览器验证见 [记录](../../ui/65-creator-documentation-preview.md)。

See the [record](../../ui/65-creator-documentation-preview.md) for feedback and actual browser validation.
