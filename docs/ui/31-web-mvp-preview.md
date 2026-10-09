# #31 Web MVP 交互预览记录

- 票据：[#31](https://github.com/CaiZongyuan/llm-music/issues/31)，父规格 [#6](https://github.com/CaiZongyuan/llm-music/issues/6)。
- 预览：[web-mvp-v1](https://github.com/CaiZongyuan/llm-music/blob/aec081f8e5254a9dc1f7ba4b606ffd7211add679/docs/previews/web-mvp-v1/README.md)。
- 实际 P1 集成基线：`15de0d9e424efaf06e5b75ffc67f57ef32421561`；#27 已关闭，#31 原生阻塞已满足。
- 状态：**用户已确认布局与流程；正式 Web 增加中英双语和亮暗模式。预览服务按用户要求关闭。**

## 要确认的体验

创作者能否围绕一个 Project 连续上传/转谱，或生成/试听/检查/明确保存，并在排队、失败、取消、断联时知道下一步。Workspace 保留底部 Player，主动作使用创作语言；运行与环境细节放在次级页面。输入只用当前已支持的短片段范围。

最新用户方向为“教程方向应该为如何更好使用以及多样化玩法而不是开发”。项目入口、风格/歌词、试听判断与版本选择采用这一语言；#65 文档确认是文档体验的确认，不代替这次产品预览确认。用户明确不需要 Swagger UI 录屏，本票没有 Swagger 或 GPU 操作。

## 预览边界

零安装 HTML/CSS/JS；自有静态服务 `127.0.0.1:18032`。所有项目、任务、上传引用、候选和保存只写本页内存。真实上传使用 Blob URL，实际音乐为已标识的历史 PR #58 副本，转谱/乐谱/MIDI 为独立合法示例。页面不连接业务 API、共享 Runtime 或 GPU。

原型呈现空/加载/失败与可操作恢复；unknown progress 只显示阶段，取消先等待确认，retry 创建新任务。候选不会自动进入版本历史。实际刷新重置原型内存，正式恢复将在后续产品对真实 FastAPI 验证；“重新读取”按钮仅演示隔离状态恢复。

## 作者验证与交接

2026-10-07，作者通过独立 `web31-developer` Chromium session（软件渲染）检查 1440 × 960 桌面与 390 × 844 窄屏。原始动作中记录 32 条结果事实，覆盖两条创作主线、媒体时钟、失败恢复、身份与输入保留、就绪边界及本地隔离；其中一条为工具 Unicode 读回检查。原始命令、事实与截图保存在 Root 的 owned `.scratch/p2-development/31-preview/`，actor 事件仅写 `.scratch/p2-development/31-events.jsonl`。

| 范围 | 实际结果 |
| --- | --- |
| 生成与版本 | queued/null progress → completed → Candidate；未明确保存时 Version 为零。保存失败保留名称与候选，重试只保存一个版本；再次选择保存进入同一 id，后续失败/重试没有改写原输入快照。 |
| 持续试听 | PR #58 音频时长约 34.998667 秒；生成→歌词→乐谱切换时 actual currentTime 从 0.827922 到 1.457853，仍在播放且只有一个 audio 元素，无媒体错误。实际暂停、键盘 seek 和有界循环选择可执行。 |
| 参考音频与转谱 | 浏览器选择真实本地 16 秒 WAV 后通过 Blob URL 播放，时长 16 秒、无媒体错误；模拟转谱结果保留该参考名称/id 与独立 Job。无效 ABC 文件作为音频被拒绝，改选合成参考后恢复。 |
| 原生下载 | 独立 Playwright Chromium context 使用 acceptDownloads:true，通过页面 MIDI/ABC 按钮取得真实 Download；failure=null，saveAs 后 69 B MIDI/57 B ABC 与 fixture 逐字节及 SHA256 一致。已有应用 MIDI 解析器读取下载文件并得到四个 note-on。 |
| 任务控制 | 两任务排队；排队与运行取消先显示 cancel_requested，随后得到 cancelled 且不产生结果。取消竞态最终为 completed 时显示完成事实。失败保留输入，明确 retry 用新 id；断联/重新读取/重连没有增加提交 id。 |
| 就绪与边界 | 缺模型、失联、过期均禁止新提交；恢复 ready 后可提交。JS 非安全整数在创建 Job 前被拒绝；0.35 的已知进度只来自明确 fixture，没有按 phase 推测百分比。 |
| 空/加载/导航 | 空 Library 可创建并打开“雨后的散步”；读取失败与加载恢复同一项目；不存在的项目可回 Library。实际刷新明确重置原型内存，未写成持久恢复证明。 |
| 窄屏与隔离 | 窄屏项目导航、参考示例操作可用，document/player 宽度都为 390，没有整页水平溢出。浏览器请求只有 owned 18032 静态 GET/本地 Blob，无未捕获异常；静态服务 POST=405，allowlist 外路径=404。 |

`agent-browser download` 最初取消下载。改用普通静态附件后仍取消，fresh session + download-path 也相同；没有把 Fetch 200 或按钮反馈当作原生下载成功。owned browser 的 CDP allow + 普通 UI 点击产生实际完成的 69 B 文件；再用上述独立 acceptDownloads:true 原生 context 检查两份文件，确认是自动化下载环境限制。Blob 下载 URL 的额外生命周期因此简化为静态文件 URL，未新增用户配置步骤。

PowerShell 未加引号的 @ref、stdin eval 和 Windows Python Store alias 曾使验证命令失败或无有效输出；使用有引号的 ref、Base64 eval、实际已安装的独立 API interpreter/native CLI 后取得事实。第一次 Playwright 脚本使用 Windows 绝对 ESM import 失败，改为现有 createRequire 入口后通过。原命令/异常保留，均未报告为产品缺陷或删成全绿。

源码语法、静态 allowlist、真实音频 hash、WAV 元数据、原生下载 bytes 与 MIDI 内容均已核验。没有运行整套 API/GPU suite，也没有修改业务配置。收尾仅简化下载归属，保留 Job 原始状态/可见快照、Candidate/Version 区别和媒体持续区域；独立审阅仍由 Root 调度。最终源码 pin、文件 SHA256 和服务身份记录于 owned `freeze.json`/`final-check.json`。

## 用户反馈与确认

Root 已对两条隔离创作流程、唯一播放器的实际时钟、明确保存 Version、16 秒本地参考输入、模型恢复与静态 GET 隔离进行独立核验。最终源码只将下载 Blob 生命周期简化为静态 attachment URL；最终原生 Chromium 下载验证覆盖该变化，两份文件字节和 SHA256 与合法 fixture 一致。证据保存在 `.scratch/p2-development/31-root-browser-facts.json`、`31-root.har` 与 `31-preview/`。

用户最初回答 **“重新启动一下”**，这仅授权恢复预览，不作为体验确认。Root 恢复同一已冻结版本并核对 HTTP200 后，再提交具体确认。用户随后回答：**“认可，需要中英双语，亮暗模式”**。该回答确认 `e2029719eab0e02d2e198f48fdd0f9e21ff360d6` 的布局与流程，并要求正式 Web 同步提供中英文及亮暗主题。沿用已确认布局、创作语言和交互，不需要重新选择整体设计。

用户随后明确要求 **“关闭预览吧”**。Root 核对自有 Node PID47544 的创建时间、脚本、端口与进程身份后停止服务，读回18032无监听，并关闭本任务的浏览器会话。预览源文件和已确认版本保留；正式 React 实现交由 #32 的新 Developer。#31 的实际关闭仍由 Root 在反馈记录集成后读回。
