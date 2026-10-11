# Local AI Music Workbench  
## Architecture & Implementation Plan

**更新日期：2026-10-11**

**阶段：Web 架构基线 / 移动端正式实施**

---

# 1. 项目定义

本项目目标是构建一个 **Local-first AI Music Workbench**。

它不是：

- ComfyUI 的换皮前端；
- YuE2 的简单 Web UI；
- 一个只提供“歌词 → 歌曲”的 Demo；
- 一个完整 DAW 的替代品。

它应该逐步成为一个围绕 AI 音乐生成、理解、转谱、编辑和版本演化建立的本地音乐工作台。

核心产品闭环：

```text
Reference Audio
      ↓
 Transcription
      ↓
 ABC / MIDI / Score
      ↓
 Inspect & Edit
      ↓
 Regenerate / Cover
      ↓
 Listen & Compare
      ↓
 New Version
```

以及：

```text
Style + Lyrics
      ↓
Score Planning
      ↓
Editable Score
      ↓
Music Generation
      ↓
Audio
      ↓
Edit Style / Lyrics / Score
      ↓
New Version
```

长期上，产品应该允许底层推理 Runtime 被替换，而不影响：

```text
Project
Asset
Version
Job
Web UI
API
```

因此整体方向是：

```text
Music Workbench
      ↓
Application Backend
      ↓
Inference Runtime Abstraction
      ↓
ComfyUI / Native YuE2 / audio.cpp / Future Runtime
```

---

# 2. 当前范围

## 2.1 当前正式开发目标

Web 基线的完整链路为：

```text
Web
 ↓
FastAPI
 ↓
ComfyUI Runtime
 ↓
YuE2 / SheetSage2
 ↓
RTX 3070 Ti 8GB
```

这是 Web 阶段的完整链路。移动端作为下一独立阶段规划，范围见 2.3。

---

## 2.2 Electron

Electron 是未来支持的平台，但：

**当前不开发、不测试、不进入 CI、不作为任何阶段验收条件。**

当前唯一要求是：

> Web 应用架构不能做出明显阻碍未来 Electron 复用的设计。

未来 Electron 原则上：

```text
Existing Web Workbench
        +
Electron Main / Preload
```

而不是重写第二套客户端。

---

## 2.3 React Native

2026-10-09 确认将移动端纳入 Web 之后的独立阶段，保留 Web 工作台。移动端首版是便携客户端，先完成：

```text
Generate
 ↓
Listen to Candidate
 ↓
Explicitly Save Version
```

首阶段验收 Android，iOS 适配与验收另行规划。首版不复制完整的乐谱编辑、转谱、Cover 与版本比较工作台。决策及取舍见 [ADR-005](adr/0005-mobile-companion-scope.md)。

移动端沿用 Project、Asset、Job、Candidate 与 Version 的现有定义，通过 FastAPI 访问同一套创作数据，不直接连接 ComfyUI。接口边界仍为：

```text
FastAPI = clean HTTP / WebSocket API
```

开发与测试均在 Windows 运行，使用 Expo SDK 57；日常优先 Expo Go，最终交付独立 Android APK，并用项目自己的二进制验证原生配置。手机首版通过局域网连接保持运行的 GPU 电脑。生成在后端继续执行，返回 App 时以 HTTP 恢复状态；首版只做前台试听，锁屏播放和完成推送列入后续能力。

2026-10-11 用户明确纠正局域网单用户自用流程：手机只输入电脑地址即可连接，不要求 PIN 配对或设备授权。手机保存电脑地址与服务器身份，HTTP、WebSocket 与原始音频直接访问同一 FastAPI 局域网入口；保持电脑身份核对、按服务器隔离草稿与未确认请求。新决策见 [ADR-007](adr/0007-direct-lan-and-stable-runtime-evidence.md)，取代 [ADR-006](adr/0006-mobile-lan-pairing.md) 的配对产品流程。旧配对实现及证据保留历史含义，直连变更须独立验证。

模型与源码的已校验事实在当前 Runtime 进程、监听、配置和文件仍匹配时继续有效，不能仅因经过五分钟使启动或创作失败。保留原来源时间，不伪造新的模型校验时间；真实进程/绑定改变、源码或文件变化、缺失权重和实际 Runtime 不可达仍按事实处理。动态健康、GPU 和内存观测与稳定模型事实分别报告。

首版操作包括项目列表/新建、风格与歌词输入、生成、任务状态/取消/明确重试、播放/暂停/seek、命名保存 Version 和查看已有版本。手机保留编辑草稿；断网保留输入，恢复连接后读取原任务，提交结果未知时先核对已有记录。地址扫描、录音/素材上传/分享与离线音乐库列入后续按需扩展。

验收要求 Android 模拟器、至少一台 Android 真机及独立 APK。日常 Maestro 使用隔离 Fake Runtime，覆盖中文/多行歌词、正常/空/加载/失败状态、连接与重启恢复、未知结果及重复提交控制；交付时运行真实 GPU 的生成、试听、明确保存闭环，并验证原始 FLAC 播放/seek。UI、音频及 GPU 证据分别记录。

三轮产品选择及最新纠正见 [移动端方案访谈](design/mobile-interview.md)。移动端复用已确认的黑色 Acid Hardware 视觉方向。2026-10-10 已完成 `apps/mobile` 初始化、完整手机工作流及电脑配对入口的隔离预览，用户回复“确认”，见 [原 UI 确认记录](ui/mobile-workbench-preview.md)。2026-10-11 新的[地址直连预览](previews/mobile-lan-direct-v1/index.html)已先交付；本次用户明确纠正已授权正式改动，不重复询问确认，见[纠正记录](ui/mobile-lan-direct.md)。初始化与历史预览的实际结果见 [初始化验证](verification/mobile-bootstrap.md) 和 [工作流预览验证](verification/mobile-workbench-preview.md)；旧 APK/GPU 证据不自动成为直连验收，持久恢复、原始音频、直连 APK 与物理 Android 继续单独取证。

其他客户端仍可通过该边界接入：

```text
Web
Electron
Mobile
CLI
Agent
Remote Client
```

---

# 3. 核心架构决策

## ADR-001：Web 使用 TanStack Router

技术基线：

```text
React
TypeScript
Vite
TanStack Router
TanStack Query
```

TanStack Router 提供类型安全路由、Search Params、Loader、Error Boundary、Prefetch 和良好的 Vite 集成；官方目前明确支持 Router + Vite 的 file-based routing。

当前采用：

```text
Vite
+
TanStack Router
+
FastAPI
```

---

# 4. ADR-002：FastAPI 是唯一 Application Backend

FastAPI 不只是：

> ComfyUI Proxy。

它是整个产品真正的业务核心。

职责包括：

```text
FastAPI
│
├─ Project Management
├─ Asset Management
├─ Version Management
├─ Job Management
├─ Workflow Registry
├─ Inference Runtime Adapter
├─ Database
├─ File Storage
├─ WebSocket Events
├─ Runtime Health
└─ Application API
```

Web 永远只与 FastAPI 通信。

禁止形成：

```text
Web → ComfyUI
```

或者：

```text
Web → ComfyUI WebSocket
```

这样的直接耦合。

唯一允许的关系是：

```text
Web
 ↓
FastAPI
 ↓
Runtime Adapter
 ↓
ComfyUI
```

---

# 5. ADR-003：ComfyUI 是 Inference Runtime，不是产品核心

这是整个项目最重要的架构原则之一。

ComfyUI 当前承担：

```text
Workflow DAG execution
Node execution
GPU job queue
Execution state
Model lifecycle
Caching
VRAM management infrastructure
CPU/GPU offload infrastructure
Inference runtime
```

ComfyUI 当前公开 API 本身已经提供 `/prompt`、`/ws`、`/history`、`/queue`、`/interrupt`、`/free` 等运行时能力，其中 `/prompt` 会验证并进入执行队列，而 `/ws` 提供节点执行和进度事件。

但：

> ComfyUI 不拥有我们的 Project、Version、Asset 或用户看到的 Job。

ComfyUI 对产品来说只是：

```text
GPU Runtime
```

类似：

```text
Airflow / Temporal
```

之于业务系统。

业务不应该知道：

```text
node 72
node 41
prompt_id
ComfyUI JSON structure
```

---

# 6. ADR-004：首版保留 YuE2-ComfyUI 的低显存实现

当前选择：

```text
ComfyUI
+
YuE2-ComfyUI
```

不是因为我们需要 ComfyUI Canvas。

而是因为当前社区 Runtime 已经解决了大量对 8GB GPU 非常重要的工程问题。

当前 YuE2-ComfyUI 报告：

```text
YuE2 offload：
约 4.4 GiB（40 秒）
约 4.5 GiB（4 分钟）

low_vram：
约 3.1 GiB

SheetSage2：
约 1.9 GiB
```

并明确区分普通 offload 与 `low_vram`。这些数字只能作为我们的参考基线，最终必须在 RTX 3070 Ti Laptop 8GB 上重新 benchmark。

所以首版原则：

> 复用已经工作的 inference engineering，而不是一开始重新发明它。

---

# 7. Runtime 必须可替换

FastAPI 内部不能出现：

```python
comfyui.post_prompt(...)
```

散落在业务代码中的情况。

应该存在稳定的：

```text
InferenceRuntime
```

概念边界。

逻辑能力：

```text
health

capabilities

submit

status

subscribe

cancel

result
```

具体实现：

```text
InferenceRuntime
       │
       ├── ComfyUIRuntime      ← 当前
       │
       ├── NativeYuE2Runtime   ← future
       │
       └── AudioCppRuntime     ← future
```

因此：

```text
ProjectService
JobService
VersionService
```

只知道：

```text
InferenceRuntime
```

而不知道：

```text
ComfyUI
```

---

# 8. 为什么暂时不直接 Native Python

理论上完全可以。

ComfyUI 工作流：

```text
Load Model
 ↓
Plan Score
 ↓
Semantic Generation
 ↓
Acoustic Synthesis
 ↓
VAE Decode
```

本质上都可以写成：

```text
Python Pipeline
```

真正困难的不是调用模型，而是：

```text
Model loading
GPU placement
CPU offloading
VRAM pressure
stage lifecycle
VAE tiled decoding
repeated jobs
memory cleanup
cancellation
queue
runtime monitoring
```

这些部分对于 8GB GPU 尤其重要。

所以当前策略：

```text
Phase 1
复用 ComfyUI Runtime

        ↓

Phase N
充分理解并 benchmark 后

        ↓

评估 Native Runtime
```

Native Runtime 是优化方向，而不是 MVP 前置任务。

---

# 9. 系统总体架构

```text
┌─────────────────────────────────────┐
│               Web                   │
│                                     │
│ React                               │
│ Vite                                │
│ TanStack Router                     │
│ TanStack Query                      │
│ Music Workspace                     │
└──────────────────┬──────────────────┘
                   │
              HTTP / WS
                   │
                   ▼
┌─────────────────────────────────────┐
│             FastAPI                 │
│                                     │
│ Projects                            │
│ Assets                              │
│ Versions                            │
│ Jobs                                │
│                                     │
│ Workflow Registry                   │
│ Runtime Adapter                     │
│                                     │
│ SQLite                              │
│ Local Asset Storage                 │
└──────────────────┬──────────────────┘
                   │
            Runtime Protocol
                   │
                   ▼
┌─────────────────────────────────────┐
│         ComfyUI Runtime             │
│                                     │
│ Queue                               │
│ Workflow DAG                        │
│ Model Management                    │
│ VRAM / Offload                      │
│                                     │
│ YuE2-ComfyUI                        │
│ ├─ YuE2                             │
│ ├─ SheetSage2                       │
│ ├─ VAE                              │
│ ├─ Cover                            │
│ └─ Editing                          │
└──────────────────┬──────────────────┘
                   │
                   ▼
             RTX 3070 Ti
```

---

# 10. Web 技术栈

建议：

```text
React
TypeScript

Vite
TanStack Router
TanStack Query

Zod

shadcn/base ui
Tailwind

wavesurfer.js
abcjs
```

TanStack Router 使用 file-based routing。

TanStack Query 管理：

```text
server state
```

例如：

```text
projects
jobs
assets
versions
runtime health
```

Zustand 只在真正有：

```text
complex local editor state
```

时使用。

禁止把：

```text
Server State
```

复制一份到 Zustand 中长期维护。

---

# 11. Web 产品信息架构

首版建议形成：

```text
Library
Project
Generate
Transcribe
Score
Jobs
Runtime
Settings
```

其中真正核心的是：

```text
Project Workspace
```

而不是一堆孤立工具页面。

---

# 12. Project 是产品核心对象

一个 Project 可以代表：

```text
一首歌曲
一次 Cover 项目
一次音乐创作实验
```

Project 内部包含：

```text
Assets
Versions
Jobs
Score
Audio
Lyrics
Style
```

用户主要围绕：

```text
Project
```

工作，而不是围绕：

```text
ComfyUI workflow
```

工作。

---

# 13. Version 是核心领域概念

每一次有意义的创作变化都形成 Version。

例如：

```text
V1 Original Generation
 │
 ├─ V2 Change Lyrics
 │
 ├─ V3 Change Style
 │    └─ V5 Edit Chord
 │
 └─ V4 Transpose Score
```

因此 Version 应允许：

```text
parent_version
```

形成版本图，而不是只有线性历史。

长期这可以演化成：

> Music Version Graph。

---

# 14. Asset 是统一文件抽象

所有实际文件统一视为 Asset。

包括：

```text
Audio
ABC
MIDI
Image
PDF
Tokens
Latents
Runtime Artifacts
```

数据库保存：

```text
metadata + path
```

实际大型二进制文件保存在文件系统。

不要把 FLAC / WAV / MIDI blob 放进 SQLite。

---

# 15. Asset Storage 原则

FastAPI 是文件资产的 owner。

ComfyUI 输出不能直接作为永久业务文件。

正确流程：

```text
ComfyUI Output
      ↓
Runtime Adapter
      ↓
Validate
      ↓
Import
      ↓
Application Asset
```

这样：

```text
ComfyUI/output/
```

只是 Runtime 工作目录。

真正长期保存的是：

```text
data/assets/
```

这非常重要，因为未来换掉 ComfyUI 后：

```text
Asset
```

不会受影响。

---

# 16. Job 与 Runtime Job 必须区分

Application Job：

```text
job_abc
```

和：

ComfyUI：

```text
prompt_xyz
```

不是同一个东西。

关系：

```text
Application Job
      ↓
Runtime Adapter
      ↓
Runtime Job
```

数据库只需要建立映射。

用户只看：

```text
job_abc
```

永远不应该看：

```text
prompt_xyz
```

---

# 17. Job 生命周期

应用标准状态：

```text
queued
running
completed
failed
cancelled
```

运行阶段可以进一步表达：

```text
preparing
loading_model

transcribing

planning_score
generating_semantic
synthesizing
decoding_audio

saving
```

FastAPI 将 ComfyUI node events 转换为：

```text
Music Domain Events
```

而不是把 Node ID 发给前端。

---

# 18. Progress 原则

如果底层有可靠 progress：

```text
0.0 → 1.0
```

则提供。

如果只能知道：

```text
当前 phase
```

但无法得到真实进度：

```text
progress = null
```

前端显示 indeterminate progress。

禁止人为写：

```text
20%
40%
60%
```

制造假的任务进度。

---

# 19. 实时通信

采用：

```text
FastAPI WebSocket
```

作为 Web 实时事件通道。

关系：

```text
ComfyUI /ws
     ↓
ComfyUIRuntime
     ↓
Application Event Bus
     ↓
FastAPI WebSocket
     ↓
Web
```

HTTP：

```text
GET /jobs/{id}
```

仍然是真正的状态恢复来源。

WebSocket：

> 提供实时性，而不是作为唯一状态数据库。

---

# 20. 服务重启恢复

FastAPI 启动时需要执行：

```text
Job Reconciliation
```

检查数据库中的：

```text
queued
running
```

Job。

Runtime Adapter 查询：

```text
ComfyUI queue
ComfyUI history
```

然后恢复为：

```text
running
completed
failed
unknown
```

不能因为 FastAPI 重启就让已有任务永久停留：

```text
running
```

---

# 21. Workflow Registry

所有 ComfyUI Workflow 纳入 Git。

但不能让业务逻辑直接操作：

```text
workflow["37"]["inputs"]
```

应增加：

```text
Workflow Registry
```

概念。

例如：

```text
generate-yue2
transcribe-sheetsage2
cover-yue2
```

每一个 Workflow 都包含：

```text
workflow definition

application input mapping

runtime output mapping

version

required models

required capabilities
```

---

# 22. Workflow 是 Runtime Implementation Detail

应用请求：

```text
GenerateSong
```

而不是：

```text
Run workflow generate_v3_api.json
```

关系：

```text
GenerateSong
    ↓
WorkflowRegistry
    ↓
generate-yue2:v1
    ↓
ComfyUI JSON
```

未来：

```text
GenerateSong
    ↓
NativeYuE2Runtime
```

时，Workflow 可以完全消失。

---

# 23. Workflow Versioning

每个 Job 都必须记录：

```text
workflow id
workflow version

runtime
runtime revision

plugin revision

model revision

settings
```

原因是 AI inference 结果只有在这些条件被记录后，才有可能进行：

```text
reproduction
comparison
debugging
```

---

# 24. Model Registry

建议从首版建立轻量 Model Registry。

记录：

```text
Model Name
Provider
Repository
Revision
Filename
SHA256
Local Path
Size
State
```

状态：

```text
missing
downloading
ready
invalid
```

当前至少覆盖：

```text
YuE2
YuE2 VAE
SheetSage2
```

以后：

```text
ASR
Stem Separation
LoRA
```

都可以统一进入这个体系。

---

# 25. Python Runtime 隔离

FastAPI 和 ComfyUI 必须是：

> 两个独立 Python environment。

建议：

```text
services/api
    uv project

runtime/comfyui
    independent uv environment
```

原因：

ComfyUI 环境会包含：

```text
PyTorch
CUDA-specific packages
audio dependencies
custom nodes
model dependencies
```

FastAPI 应保持：

```text
small
stable
fast
independent of CUDA
```

否则每次升级 Torch / ComfyUI 都可能破坏业务后端。

---

# 26. 数据库

首版：

```text
SQLite
```

推荐：

```text
SQLAlchemy 2
Alembic
```

而不是把 sqlite3 SQL 分散到业务代码里。

启用适合本地应用的：

```text
WAL
```

模式。

SQLite 当前足以支撑：

```text
单机
单用户
单 GPU queue
```

不要提前使用 PostgreSQL。

---

# 27. API Contract

FastAPI Pydantic Model 是 API Source of Truth。

通过：

```text
Pydantic
  ↓
OpenAPI
  ↓
Generated TypeScript Client
```

生成前端 client。

禁止：

```text
Python 定义一次

TypeScript 再手写一次
```

API 类型。

---

# 28. 当前核心能力

首版只要求四个 domain-level operation：

```text
Transcribe
Generate
GenerateFromScore
Cover
```

其中：

### Transcribe

```text
Audio
 ↓
SheetSage2
 ↓
Score / ABC / MIDI
```

### Generate

```text
Style
Lyrics
 ↓
YuE2
 ↓
Score
 ↓
Audio
```

### GenerateFromScore

```text
ABC
Style
Lyrics
 ↓
YuE2
 ↓
Audio
```

### Cover

```text
Reference Audio
 ↓
Transcribe
 ↓
Score
 +
New Style
 ↓
Generate
```

---

# 29. 不要把 Cover 做成黑盒

从产品角度：

```text
Reference
 ↓
Cover
 ↓
Audio
```

虽然简单，但损失了本项目最大的价值。

应该显示中间：

```text
Reference Audio
      ↓
Transcribed Score
      ↓
User Inspect / Edit
      ↓
Target Style
      ↓
Generate
```

这就是：

> White-box AI music workflow。

---

# 30. Score 是 First-class Object

Score 不只是某个 Job 输出的字符串。

Score 是整个产品的重要资产。

首版：

```text
ABC
```

作为 source representation。

同时支持：

```text
MIDI
```

作为交换和试听格式。

UI：

```text
abcjs
```

负责：

```text
staff rendering
playback visualization
basic interaction
```

---

# 31. Score Editing 首版边界

第一版只做：

```text
ABC text editing
score preview
MIDI export
playback
```

不要一开始实现：

```text
MuseScore
Ableton
Piano Roll DAW
```

级别的编辑器。

后续再增加：

```text
Transpose
Tempo
Chord Editing
Piano Roll
```

---

# 32. Audio Workspace

首版采用：

```text
wavesurfer.js
```

处理：

```text
waveform
playback
seek
regions
```

Audio Player 最好成为 Project Workspace 的持续存在区域。

目标：

用户切换：

```text
Versions
Score
Lyrics
Settings
```

时仍可以继续：

```text
A/B listening
```

---

# 33. Web Workspace 基本结构

推荐概念布局：

```text
┌──────────────────────────────────────────────┐
│ Project                             Runtime ● │
├──────────────┬───────────────────────────────┤
│ Versions     │                               │
│              │                               │
│ Assets       │          Workspace            │
│              │                               │
│ Jobs         │                               │
│              │                               │
├──────────────┴───────────────────────────────┤
│                Audio Player                  │
└──────────────────────────────────────────────┘
```

Workspace 根据任务切换：

```text
Generate
Transcribe
Score
Compare
```

---

# 34. Runtime 页面

产品中应该存在一个简单：

```text
Runtime
```

页面。

显示：

```text
GPU
VRAM
Runtime Status

ComfyUI Version
Plugin Revision

Loaded Models
Model Status

Queue
Current Job

Backend Health
```

这对于本地 AI 应用非常重要。

尤其是你当前：

```text
3070 Ti Laptop 8GB
```

这样资源紧张的环境。

---

# 35. Runtime Diagnostics

从 P0 开始记录：

```text
GPU model
driver

Torch
CUDA

ComfyUI commit
YuE2-ComfyUI commit

model revision

peak VRAM
peak RAM

model load time

planning time
semantic generation time
synthesis time
VAE time

total runtime

output audio duration
```

以及：

```text
RTF
```

即：

```text
generation seconds
------------------
audio seconds
```

这会成为后面判断优化是否有效的主要指标。

---

# 36. 当前 YuE2 Baseline

第一轮测试使用：

```text
offload = true
low_vram = false

keep_model_loaded = false

max_seconds ≈ 30–40

cot = full
```

应用层更新（2026-10）：正式产品的 `max_seconds` 开放为 0–360，默认 0 = 自动（跟随歌词，模型下限约 40 秒，硬上限 360 秒）。第一轮 P0 的 30–40 秒 baseline 记录保持原样；新档位的真机验证记录见 `docs/verification/`。

Attention backend：

先使用插件推荐且在当前环境稳定的实现。

不要 P0 一开始同时调整：

```text
quantization
attention
ODE steps
VAE
sampling
```

否则问题发生时无法知道是哪一个变量导致。

---

# 37. Low VRAM 策略

测试顺序：

```text
BF16
+
offload
+
low_vram=false
```

如果稳定：

保持。

如果 OOM：

再切换：

```text
low_vram=true
```

然后记录：

```text
VRAM
speed
RAM
output difference
```

不要因为“低显存模式存在”就默认打开。

---

# 38. P0 — Runtime Validation

这是整个项目第一阶段，而且是最重要的阶段。

**不开发正式 Web UI。**

目标：

> 证明 Runtime 在真实机器上值得构建产品。

---

## P0.1 环境

建立并锁定：

```text
Python
Torch
ComfyUI
YuE2-ComfyUI
models
```

保留：

```text
versions
commits
hashes
```

---

## P0.2 Runtime Doctor

创建：

```text
scripts/doctor
```

检查：

```text
GPU detected
VRAM
Torch CUDA
ComfyUI import
custom node
models
disk
ports
```

开发者必须可以运行一条命令知道：

> Runtime 是否 ready。

---

## P0.3 Transcription

使用一个固定短音乐样本。

验证：

```text
Audio
 ↓
SheetSage2
 ↓
ABC
MIDI
```

必须完全通过 API mode 完成。

不能依赖：

```text
手工操作 ComfyUI Canvas。
```

---

## P0.4 Generation

使用固定：

```text
style
lyrics
seed
```

生成约：

```text
30–40 秒
```

音乐。

记录：

```text
VRAM
RAM
Time
Output
```

---

## P0.5 Repeated Jobs

连续执行：

```text
至少 5–10 个任务
```

重点观察：

```text
VRAM growth
RAM growth
model reload
stale cache
crash
CUDA OOM
```

这一项比：

> “成功生成一首”

重要得多。

---

## P0.6 Queue

连续提交多个任务。

验证：

```text
Job A
Job B
Job C
```

严格串行运行。

当前单 GPU concurrency：

```text
1
```

---

## P0.7 Cancel

分别测试：

```text
Cancel queued
Cancel running
```

因为 ComfyUI `/interrupt` 本身作用于当前执行任务，所以 Runtime Adapter 必须确认当前任务归属后才能调用。ComfyUI 当前确实提供 queue/history/interrupt 等运行时接口。

---

# 39. P0 验收

必须证明：

```text
API → Transcription → ABC/MIDI
```

和：

```text
API → YuE2 → Playable Audio
```

都可以稳定工作。

并完成：

```text
queue
cancel
history
repeat
cleanup
```

测试。

最终输出：

```text
runtime-report
benchmark
logs
known limitations
```

只有 P0 通过：

> 才进入正式产品开发。

---

# 40. P1 — FastAPI Application Core

P1 暂时不开发复杂 UI。

通过：

```text
curl / Swagger
```

即可操作整个系统。

实现：

```text
Project
Asset
Job
Version

Runtime Adapter
Workflow Registry
Storage
Database
```

---

# 41. P1 最重要的验收路径

必须做到：

```text
Create Project
 ↓
Upload Audio
 ↓
Create Transcribe Job
 ↓
Wait
 ↓
Get ABC
 ↓
Get MIDI
```

以及：

```text
Create Generate Job
 ↓
Wait
 ↓
Get Audio
 ↓
Get Score
 ↓
Create Version
```

全部只依赖：

```text
FastAPI
```

---

# 42. P2 — Web MVP

P2 才开始正式 Web。

首先实现：

```text
Project Library
Project Workspace
Job Monitor
Runtime Status
```

然后：

```text
Transcribe
Generate
```

---

# 43. P2 验收

Web 中完成：

```text
Upload
 ↓
Transcribe
 ↓
View Score
 ↓
Download MIDI
```

以及：

```text
Style + Lyrics
 ↓
Generate
 ↓
Listen
 ↓
Save Version
```

刷新浏览器后：

```text
Project
Version
Jobs
Assets
```

全部可以恢复。

---

# 44. P3 — Score Editing Loop

增加：

```text
ABC Editor
Score Preview
MIDI Playback
```

以及：

```text
Score
 ↓
Modify
 ↓
Generate
 ↓
New Audio
 ↓
New Version
```

这是项目开始真正区别于普通 AI Music Generator 的阶段。

---

# 45. P4 — Cover Workflow

增加：

```text
Reference Audio
 ↓
Transcribe
 ↓
Inspect Score
 ↓
New Style
 ↓
Generate
 ↓
New Version
```

明确支持：

```text
melody mode
full mode
```

并把两种模式在 UI 中解释清楚。

---

# 46. P5 — Version & Compare

增强版本系统。

提供：

```text
parent version
branch
compare
```

以及最重要的：

```text
A/B Audio
```

对比。

用户能够快速比较：

```text
V2 vs V5
```

而不需要反复打开文件。

---

# 47. P6 — Advanced AI Music Capabilities

等核心闭环稳定后，再逐步加入：

```text
Lyrics Recognition
Stem Separation
LoRA
Instrumental Generation
MIDI → Song
Continue
Edit Track
Local Retake
```

每一个都是：

```text
Capability
```

而不是直接暴露：

```text
ComfyUI Node。
```

---

# 48. P7 — Runtime Evaluation

到这一阶段再认真评估：

```text
是否继续使用 ComfyUI？
```

指标包括：

```text
performance
memory
startup
packaging
maintainability
workflow complexity
debugging
API limitation
```

如果 ComfyUI 已经开始成为瓶颈：

```text
NativeYuE2Runtime
```

才进入开发。

---

# 49. Native Runtime 的迁移目标

如果架构正确，迁移应该只是：

```text
ComfyUIRuntime

↓

NativeYuE2Runtime
```

而以下全部保持：

```text
Web
FastAPI API
Project
Asset
Job
Version
Database
```

不变。

这就是 Runtime abstraction 是否成功的最终检验。

---

# 50. Electron

Electron 不进入当前 Roadmap 阶段。

只列为：

```text
Future Packaging Target
```

当 Web 产品稳定后：

```text
Electron
   ↓
reuse Web Workbench
```

Electron 自己只增加：

```text
Main
Preload
Window
File Picker
Runtime Process Manager
System Notifications
```

不重写业务 UI。

---

# 51. Electron 未来可能承担的真正价值

Electron 最大价值不是：

> 把网页装进窗口。

而是未来管理：

```text
FastAPI process
ComfyUI process
Runtime installation
Runtime updates
Model download
File system
GPU doctor
```

最终让整个应用：

```text
Install
 ↓
Open
 ↓
Ready
```

但这是一个独立的大型 Packaging 项目。

当前完全不做。

---

# 52. 当前 Non-goals

Web MVP 的 non-goals 如下。移动端进入正式实施，在局域网单用户自用范围直接连接 FastAPI，不改变 Web MVP 原有范围。公网访问、账号体系、锁屏播放和完成推送不属于移动端首版。

```text
完整移动音乐工作台
Cloud SaaS
Multi-user
Authentication
PostgreSQL
Distributed GPU
Multiple GPU workers
Collaborative Editing
Full DAW
Advanced Piano Roll
Electron Packaging
Native YuE2 Rewrite
```

这部分必须明确写进项目文档。

否则开发过程中很容易不断扩大 scope。

---

# 53. 推荐仓库结构

```text
llm-music/

├─ apps/
│  └─ web/
│
├─ services/
│  └─ api/
│
├─ runtime/
│  └─ comfyui/
│
├─ packages/
│  ├─ api-client/
│  └─ core/
│
├─ workflows/
│  ├─ generate/
│  ├─ transcribe/
│  └─ cover/
│
├─ scripts/
│
├─ docs/
│
└─ data/
   ├─ app.sqlite
   ├─ assets/
   ├─ models/
   ├─ runtime/
   └─ temp/
```

暂时不要创建：

```text
apps/desktop
apps/mobile
```

移动端范围见 2.3；完成方案确认并真正进入开发时再创建。

---

# 54. Source Control

进入 Git：

```text
source code
workflow definitions
workflow manifests
database migrations
dependency locks
scripts
docs
```

不进入 Git：

```text
models
audio
database
generated assets
runtime cache
Python venv
Node modules
ComfyUI user state
```

---

# 55. 开发环境管理

JS：

```text
pnpm
```

Python：

```text
uv
```

两个 Python Project：

```text
services/api

runtime/comfyui
```

分别 lock。

不要共享 venv。

---

# 56. 开发启动体验

最终目标：

```text
scripts/dev.ps1
```

或者：

```text
pnpm dev
```

可以启动：

```text
FastAPI
ComfyUI
Web
```

但这些仍然是三个独立 process。

脚本只负责 orchestration。

---

# 57. Observability

即使是本地软件，也应该从一开始有：

```text
structured logs
job timing
runtime errors
model load timing
memory metrics
```

每个 Job 应能回答：

```text
What happened?

Which model?

Which workflow?

Which settings?

How long?

How much memory?

Why failed?
```

---

# 58. Error Model

不要直接把：

```text
CUDA OOM
Python traceback
ComfyUI node exception
```

原样作为主要 UI。

FastAPI 应转换为：

```text
runtime_out_of_memory
model_missing
workflow_invalid
runtime_unavailable
cancelled
transcription_failed
generation_failed
```

同时：

```text
developer details
```

仍写日志。

---

# 59. Testing Strategy

测试分四层：

```text
Unit

Backend Integration

Runtime Integration

End-to-End
```

Unit：

不需要 GPU。

Backend Integration：

使用 Fake Runtime。

Runtime Integration：

真实 ComfyUI + GPU。

E2E：

真实 Web + FastAPI + ComfyUI。

---

# 60. Fake Runtime

建议早期就建立：

```text
FakeInferenceRuntime
```

这样前端和 FastAPI 开发不需要每天真的跑 YuE2。

例如：

```text
submit
 ↓
wait 2 seconds
 ↓
return sample audio
```

这样：

```text
Web development
```

和：

```text
GPU Runtime development
```

能够并行。

---

# 61. CI 原则

普通 CI：

```text
不需要 GPU。
```

运行：

```text
TypeScript checks
frontend tests
FastAPI tests
database tests
FakeRuntime integration
```

真实 GPU 测试：

```text
local
manual
release validation
```

即可。

当前不为 GPU CI 增加成本和复杂度。

---

# 62. 安全边界

当前服务默认：

```text
127.0.0.1
```

FastAPI 默认本地入口：

```text
localhost only
```

ComfyUI：

```text
localhost only
```

不要把 ComfyUI 暴露到局域网。

移动端已确定需要局域网：

```text
remote control
```

应通过：

```text
FastAPI
```

进入同一个应用 API；手机输入电脑地址即可连接。

当前保留 API loopback 默认值，并以明确局域网地址启用额外监听，两者共享同一数据和队列；ComfyUI 仍仅监听本机。2026-10-11 用户选择单用户局域网直接访问，手机 HTTP、WebSocket 与音频均不以 PIN 或设备凭据作为操作前提，见 [ADR-007](adr/0007-direct-lan-and-stable-runtime-evidence.md)。真实 socket 归属、服务器身份、实际 Runtime 绑定与文件仍按事实核对；未变更的模型校验结果不按五分钟时钟失效。局域网直连的实际入口与二进制另行验证，历史配对证据保留原时点。

---

# 63. License Registry

Model Registry 同时记录：

```text
license
```

不要只记录名称。

尤其区分：

```text
code license
model weight license
```

这样未来商业化时，可以直接知道：

> 哪一个 Runtime Capability 需要重新评估许可。

---

# 64. Developer 后续应产出的 Spec

这份 Plan 通过后，建议开发者不要写一份超大的 Implementation Spec。

应该分别产出：

```text
SPEC-001 Runtime Validation

SPEC-002 FastAPI Application Core

SPEC-003 Data & Asset Model

SPEC-004 ComfyUI Runtime Adapter

SPEC-005 Workflow Registry

SPEC-006 Web Application Architecture

SPEC-007 Transcription Experience

SPEC-008 Generation Experience

SPEC-009 Score Workspace

SPEC-010 Job & Progress System

SPEC-011 Versioning & Compare

SPEC-012 Runtime Diagnostics
```

每份 Spec：

```text
目标
范围
非目标
接口
数据结构
模块
错误处理
测试
验收
迁移影响
```

然后 Spec 再拆：

```text
GitHub Issues
```

---

# 65. 推荐 Issue 层级

例如：

```text
Epic: P0 Runtime Validation

├─ Install pinned ComfyUI runtime
├─ Install YuE2-ComfyUI
├─ Runtime doctor
├─ Download model registry
├─ Export generate workflow
├─ Export transcribe workflow
├─ API transcribe test
├─ API generation test
├─ queue test
├─ cancellation test
├─ repeated inference test
└─ benchmark report
```

这样：

```text
Plan
 ↓
Spec
 ↓
Epic
 ↓
Issue
 ↓
PR
```

形成清晰的工程链。

---

# 66. 第一阶段真正应该解决的问题

项目现在最重要的问题不是：

> Web 页面长什么样？

而是：

> **RTX 3070 Ti Laptop 8GB 上，YuE2 + SheetSage2 是否可以成为一个稳定、连续运行、可 API 化调用的本地 Runtime？**

所以第一阶段只需要证明：

```text
ComfyUI
+
YuE2-ComfyUI
+
RTX 3070 Ti
```

能够稳定完成：

```text
Transcribe
Generate
Queue
Cancel
Repeat
Cleanup
```

如果答案是 Yes：

再构建整个产品。

---

# 67. 项目核心原则

最终整个团队应始终遵守以下原则：

> **保留 Web 工作台，移动端作为下一独立阶段。**

> **FastAPI 是产品业务核心。**

> **ComfyUI 是 Runtime，不是产品。**

> **前端永远不直接依赖 ComfyUI。**

> **业务代码永远不直接依赖 ComfyUI Node ID。**

> **所有 Runtime 都通过统一 abstraction。**

> **Asset 归应用所有，而不是归 Runtime 所有。**

> **Project / Version / Job 是业务概念；Workflow / Prompt 是 Runtime 概念。**

> **首版优先复用低显存工程，不重复造轮子。**

> **先证明 Runtime 稳定，再做大量 UI。**

> **所有结果必须可追溯到模型、Runtime、Workflow 和参数。**

> **所有重要创作变化都应该成为 Version。**

> **Electron 当前只保持兼容性，不参与开发和测试。**

> **移动端首版先完成生成、试听候选结果与明确保存版本，Android 先验收。**

> **任何抽象都必须服务真实需求，不为假想未来提前增加复杂度。**

---

# 68. 成功定义

项目 MVP 成功不是：

> 能生成一首歌。

而是用户能够稳定完成：

```text
Create Project
      ↓
Upload Audio
      ↓
Transcribe
      ↓
Inspect Score
      ↓
Edit Score
      ↓
Generate New Audio
      ↓
Listen
      ↓
Compare
      ↓
Save Version
```

以及：

```text
Create Project
      ↓
Style + Lyrics
      ↓
Generate
      ↓
Inspect Score
      ↓
Edit
      ↓
Regenerate
      ↓
Version
```

并且整个过程：

```text
不需要打开 ComfyUI Canvas
不需要手工移动模型
不需要手工处理输出文件
不需要理解 ComfyUI Node
```

对于最终用户来说：

> **ComfyUI 应该是不可见的。**

这就是当前架构最终要达到的产品状态。
