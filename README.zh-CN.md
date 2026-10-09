<div align="center">

<img src="apps/docs/public/images/logo-wordmark-zh.webp" alt="声间 · Shengjian" width="360">

# 声间 · Shengjian

**给音乐一个地方。**<br>
*在本地生成、理解与重新塑造歌曲的 AI 音乐工作台。*

[English](README.md) · [简体中文](README.zh-CN.md) · [📖 使用文档](https://caizongyuan.github.io/llm-music/zh-cn/overview/) · [🎧 先听真实样例](https://caizongyuan.github.io/llm-music/zh-cn/overview/#listen)

[![Web workbench](https://github.com/CaiZongyuan/llm-music/actions/workflows/web-foundation.yml/badge.svg?branch=main)](https://github.com/CaiZongyuan/llm-music/actions/workflows/web-foundation.yml)
[![Application API](https://github.com/CaiZongyuan/llm-music/actions/workflows/application-api.yml/badge.svg?branch=main)](https://github.com/CaiZongyuan/llm-music/actions/workflows/application-api.yml)
[![Browser tests](https://github.com/CaiZongyuan/llm-music/actions/workflows/browser-tests.yml/badge.svg?branch=main)](https://github.com/CaiZongyuan/llm-music/actions/workflows/browser-tests.yml)
[![Documentation](https://github.com/CaiZongyuan/llm-music/actions/workflows/documentation.yml/badge.svg?branch=main)](https://github.com/CaiZongyuan/llm-music/actions/workflows/documentation.yml)

![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078D6?logo=windows11&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-24-5FA04E?logo=nodedotjs&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-11.22.0-F69220?logo=pnpm&logoColor=white)
![Verified GPU](https://img.shields.io/badge/verified_target-RTX_3070_Ti_8GB-76B900?logo=nvidia&logoColor=white)
![Code license](https://img.shields.io/badge/code_license-MIT-3DA639)
![Model weights](https://img.shields.io/badge/model_weights-CC--BY--NC--4.0-orange)

</div>

---

从一种情绪、几行歌词，或者一段参考旋律开始。生成音乐，检查乐谱，修改一个乐句，再听听另一种方向。声间把音频、乐谱、输入与已保存版本放进同一个 Project，保留在你自己的电脑上。

<div align="center">

![声间真实 Web 工作区：已保存的本地 GPU 音乐、波形与 A/B 版本比较](apps/docs/public/images/shengjian-workspace.png)

*真实 Web 应用，播放器中的音乐来自本地生成的 melody/full Cover。[截图来源记录](apps/docs/public/images/shengjian-workspace.provenance.json)。*

</div>

## ✨ 从一个想法，走到自己的作品

| 从这里开始 | 可以做什么 | 动手试试 |
| --- | --- | --- |
| 🎤 风格 + 歌词 | 生成一段歌曲，试听结果，检查生成的 ABC 乐谱。 | [做出第一段音乐](https://caizongyuan.github.io/llm-music/zh-cn/first-music/) |
| 🎼 参考音频 | 把旋律转成 ABC/MIDI，检查谱面，并与原音频对照。 | [探索参考旋律](https://caizongyuan.github.io/llm-music/zh-cn/reference/) |
| ✏️ 可编辑乐谱 | 编辑 ABC、预览谱面、试听/导出对应 MIDI，保存并选择 Score，再据此生成音乐。 | [编辑与再生成](https://caizongyuan.github.io/llm-music/zh-cn/edit-score/) |
| 🎭 一种新演绎 | 先检查转谱结果，再选择 melody 或 full Cover，以新风格生成。 | [尝试 Cover](https://caizongyuan.github.io/llm-music/zh-cn/cover/) |
| 🔀 喜欢的版本 | 从已保存 Version 继续创作、保留分支，在持续存在的播放器里进行 A/B 试听。 | [探索不同版本](https://caizongyuan.github.io/llm-music/zh-cn/variations/) |

> **Candidate → Version（候选 → 版本）。** 生成先得到可以试听和重新查看的 **Candidate（候选结果）**。你明确保存后，它才成为 **Version（版本）**。已保存的输入、输出与父版本关系记录每次选择；后续草稿与生成保留原有作品。

播放器随你在工作区标签之间切换。A/B 在相同的绝对秒数切换，可以查看波形、调整位置，也可以把两段音频共有的区间播放一次。刷新后恢复仍有效的已保存版本选择与当前 A/B 侧，暂停在开头；播放位置与区间仅属于当前会话。

Web 支持中英文、明暗主题、任务跟踪、取消、明确重试，以及读取或保存中断后的恢复。创作在本地工作台完成；文档站提供教程与已有音乐样例。

## 🚀 没有 GPU，也可以先打开工作台

使用 CPU Fake Runtime 熟悉操作或开发应用。先安装 Git、Node.js 24、pnpm **11.22.0** 与 [uv](https://docs.astral.sh/uv/)。API 使用 Python 3.12；已验证环境为 Windows x64。

在终端执行：

```powershell
git clone https://github.com/CaiZongyuan/llm-music.git
cd llm-music
pnpm install --frozen-lockfile
uv sync --project services/api --frozen
pnpm dev -- --mode fake --open
```

启动器构建 API client，启动 FastAPI 与 Web，健康检查通过后打开 **http://127.0.0.1:5173**。创建 Project，填写风格与歌词，生成 Candidate，再明确保存一个 Version。

> [!WARNING]
> **Fake 模式输出测试素材，其中生成音频为 440 Hz 测试音。它不生成模型音乐，也不能用于判断音乐质量。** 此模式无需 GPU、模型权重、Torch 或 ComfyUI。

按 **Ctrl+C** 停止本次会话启动的服务。Project、Asset、Candidate 与 Version 保留在 `data/dev/fake/application/`。启动器输出会话记录与日志路径；[启动、端口、复用与失败恢复](https://caizongyuan.github.io/llm-music/zh-cn/dev-launcher/)有完整说明。

## 🎛️ 在本地生成真实音乐

按 [Runtime 准备指南](https://caizongyuan.github.io/llm-music/zh-cn/quickstart/)准备锁定版本的 ComfyUI/YuE2/SheetSage2 Runtime 与模型文件。指南覆盖独立 Python 3.12.13 环境、约 **9.19 GB** 权重、GPU/驱动检查，以及 Doctor 失败恢复。

API 依赖与 Runtime 准备完成，且没有现有 Runtime 监听时，在仓库根目录启动：

```powershell
pnpm dev -- --mode comfyui --open
```

这会启动三个独立服务：Web、FastAPI 与 ComfyUI。启动器检查就绪状态与进程归属，不安装 Runtime 依赖、不下载模型。已有 Runtime 时，按[验证后的复用流程](https://caizongyuan.github.io/llm-music/zh-cn/dev-launcher/#native)连接。

真实模式的应用数据单独保存在 `data/dev/comfyui/application/`。FastAPI 与 ComfyUI 各有独立的 **uv 项目、虚拟环境与锁文件**。服务全部绑定 `127.0.0.1`；Web 连接 FastAPI，由 FastAPI 调用推理并把结果导入应用自己的存储。

已演示的 GPU 配置为 **Windows x64 · RTX 3070 Ti Laptop · 8 GB 显存**，生成片段约 **35 秒**。这是已验证目标，不能据此保证所有 8 GB GPU 都兼容。当前转谱接收 **16 秒 PCM16 WAV**，单声道 24 kHz 或双声道 48 kHz。Cover 也可将已保存 Version 的前 16 秒提取为新的参考音频。

## ✅ 已实际验证的范围

当前 MVP 通过真实 Web/FastAPI/ComfyUI 链路连接生成、转谱、ABC 编辑、MIDI 试听/导出、再生成、两种 Cover 模式、已保存分支与 A/B 试听。

- 真实 GPU 验收从已保存的 full Cover Version 创建新分支：完整解码为约 35 秒双声道音乐，在目标机器上的无缓存工作流执行实测 **37.694 秒**。
- 实际重启 API 进程后，该验收数据集的已保存记录与全部 **22 个 Asset 哈希**保持一致；全新浏览器恢复了已保存比较与原音频。
- 完整 **17 项已保存版本比较测试**在两次记录中的音乐 CI 运行均通过。CPU 测试素材验证应用行为，真实 GPU 记录单独证明相应推理结果。

详情见 [MVP 验收记录](docs/verification/mvp.md)、[目标机器 Runtime 报告](docs/verification/p0-runtime-report.md)与[真实音乐交付](https://github.com/CaiZongyuan/llm-music/pull/95#issuecomment-6071434961)。

> [!IMPORTANT]
> 当前版本聚焦短片段、单机单用户与单 GPU 队列。长歌曲、任意参考格式、精确转谱/声学保真以及其他硬件配置不在已演示范围内。Cover 模式描述乐谱条件，不保证保留歌手身份或每一个生成音符。

## 🏗️ 开发者入口

```text
┌────────────────────────────────────────────────┐
│  Web · React / Vite / TanStack Router + Query  │
└──────────────────────────┬─────────────────────┘
                           │  HTTP / WebSocket
┌──────────────────────────▼─────────────────────┐
│    API · FastAPI · SQLite · 本地 Asset 存储    │
└──────────────────────────┬─────────────────────┘
                           │  Runtime adapter
┌──────────────────────────▼─────────────────────┐
│     Runtime · ComfyUI · YuE2 · SheetSage2      │
└────────────────────────────────────────────────┘
```

FastAPI 管理 Project、Asset、Score、Job、Candidate 与 Version。Pydantic/OpenAPI 契约生成 TypeScript client。ComfyUI 提供推理，node 与 prompt 保留在 Runtime 边界内。

| 路径 | 用途 |
| --- | --- |
| [`apps/web/`](apps/web/) | React 音乐工作区、谱面与持续存在的音频播放器 |
| [`services/api/`](services/api/) | 应用 API、持久化与 Runtime adapter |
| [`runtime/comfyui/`](runtime/comfyui/) | 锁定 Runtime、模型清单、准备与 Doctor |
| [`packages/api-client/`](packages/api-client/) | 生成的 TypeScript API client |
| [`workflows/`](workflows/) | 带版本的推理定义与清单 |
| [`docs/`](docs/) · [`apps/docs/`](apps/docs/) | 中英文文档源与 Astro/Starlight 站点 |

安装依赖后，可在仓库根目录执行：

```powershell
pnpm web:check
pnpm client:check
pnpm test:launcher
pnpm docs:check
pnpm docs:build
```

浏览器测试从[验证指南](docs/guides/browser-tests.md)开始。修改范围或架构前，阅读 [AGENTS.md](AGENTS.md) 与[产品规划](docs/production.md)。规格与工作记录位于 [GitHub Issues](https://github.com/CaiZongyuan/llm-music/issues)。

## 📄 许可

声间源码以 [MIT 许可证](LICENSE) 发布。

已登记的模型权重（YuE2、SheetSage2）沿用上游 **CC-BY-NC-4.0** 许可。权重单独准备，不随本仓库分发。模型与上游代码许可分别记录在[模型清单](runtime/comfyui/models.json)与 [Runtime 配置](runtime/comfyui/runtime.json)中。

---

<div align="center">

**声间 · Shengjian** — 你的音乐，留在你自己的电脑上。

[📖 使用文档](https://caizongyuan.github.io/llm-music/zh-cn/overview/) · [🎧 先听样例](https://caizongyuan.github.io/llm-music/zh-cn/overview/#listen) · [🐝 Issues](https://github.com/CaiZongyuan/llm-music/issues)

</div>
