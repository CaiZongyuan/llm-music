# #43 Cover 交互预览记录

- 票据：[#43](https://github.com/CaiZongyuan/llm-music/issues/43)，父规格 [#8](https://github.com/CaiZongyuan/llm-music/issues/8)，关联 #7/#9。规格父 issue 保持只读。
- 基线：`8fe1ed0c6c1f8016861a45e80f91351bc3bd2450`，实际 #42 / PR #88 合并，阻塞已关闭、Root 已确认 P3 gate。
- Owner：`/root/cover_preview_developer`；branch `p4/43-cover-preview`；worktree `.worktrees/43-cover-preview`。
- 预览：[cover-v1](../previews/cover-v1/README.md)，<http://127.0.0.1:18084/llm-music/cover-preview/>。
- 状态：可运行候选，等待 Root 独立审阅和用户对本次 Cover 流程的具体确认；不实施正式 #44/#45。

## 要确认的体验

复用已批准 #31/#39 的 Workspace、持续唯一 Player、双语、亮暗主题与最新创作者使用方向。Reference→模拟转谱→可见/可编辑 Score→明确选定→新风格/模式→模拟 Candidate→明确模拟保存 Version。需要确认 full 与 melody 的音乐提示差别、原谱与派生有效输入的关系，以及失败/取消后继续使用中间乐谱的流程是否清楚。

mode 改变保留草稿与旧选择，须重新明确选定；有效 ABC 可展开检查、单独 MIDI 试听。full→melody 只去音乐行和弦，保留两个声部、音符、节奏及头部名称，无需新 GPU 转谱。melody→full 不造和弦，无检测和弦时明确提示缺少显式和声。Reference 变化保留旧中间 Score，但阻止以旧来源新提交。提交冻结 mode/style/lyrics/ABC；继续编辑不能改变旧 Job。模拟完成不自动保存；历史 V1 来源有明确 parent，本地参考没有 parent。

## 模式证据和隔离

独立 `/root/cover_mode_semantics_researcher` 读取 pinned plugin `fc78df9dfb214f396aa281f5b03519cefff5b00a` 源码、三个只读 native descriptors GET 与标准库 CPU probe，记录 Root `.scratch/p4-development/43-mode-semantics.md/json`。未加载 torch/model，也没有 GPU 或 Runtime mutation。源链接、映射和限制保留于预览 README；正式 GFS 当前仍是 full，页面明确标记正在探索未来 Cover。

示例全谱 SHA256 `240efaf85bded3ac49276c2b46f5592814a7ae1338e55980147b5020a56dc5fc`，melody 有效谱 `cfd68fcade6dc9b3b10afbb3d6440c6e121d6ad99ce0ec1a86f073d1d0b5ec56`。作者独立使用当前相同锁定标准库解析器读回浏览器 ABC：JS 音乐行去和弦输出与 native `strip_chords(..., keep_voice='both')` 逐字一致；两声部音符/起点/时值/小节网格与 tempo 比较 match。full Vocal16 / Ins8 音符与4和弦，melody同24音符、0和弦。这里不把 symbolic 一致当作音频效果证明。

模拟 Reference/Score/Jobs/Candidate/Version 全在页面内存；真实上传只有浏览器文件读取，当前预览只接本地 WAV。谱面、MIDI、简单合成 WAV、播放器时钟与下载是真实本地行为。参考与 Candidate 试听复用带标记的历史 PR #58 音乐，独立 ABC 不声称来自该音频，不能据此判断此次转谱或 Cover 音乐质量。没有生产 API、GPU 或持久写入；刷新重置模拟内存。

## 作者实际验证

2026-10-08，先以 agent-browser 独立 `cover43-developer` Chromium session 实际操作；为确认原生 Download completion，再以已有 Playwright Chromium 的独立 context 验证具体按钮与可读结果。没有新增正式测试、框架或 production dependency。最后受影响候选 **31 条浏览器事实通过，0 page errors**，原始 driver、facts、失败记录、截图和 CPU 结果在 owned `.scratch/43-preview/`。

| 范围 | 实际结果 |
| --- | --- |
| 正常闭环 | 空态禁止提交；历史参考→full独立示例→编辑/明确选定→melody有效输入→Candidate→明确保存派生Version；完成后仍只有原V1，保存后两Version。新版本保留reference/mode/effective ABC/parent，原V1 ABC逐字保持原样。 |
| 两模式/冻结 | mode改变保持原selected，禁新提交直至重新选定；有效ABC保留quoted声部名称与两声部音乐。提交后改首音，任务原source/effective ABC不变。有效melody MIDI 10.2s实际播放，媒体error=null。 |
| MIDI与Player | 草稿导出实际Download完成，failure=null，685B SMF，SHA256 `2be7732affdd0ef587a522d0d68b6d954838719e228804097f45c04845a78431`。真实当前MIDI WAV10.2s，currentTime前进；歌词/版本切换同src继续播放，页面仅一个audio。 |
| 恢复/错误 | 转谱失败和取消保留旧编辑谱；生成OOM和取消保留中间谱/旧版本。重试得到新Candidate但不新增Version；保存失败保留名称和Candidate，再次明确保存同一结果。模式不支持和缺模型禁止任务且不fallback。 |
| 输入/谱面 | 无效文本保留，旧notation明确过期，禁选定/生成。谱面失败不丢文本、禁过期试听，更新恢复。ABC文件冒充音频被拒绝，旧reference保留；实际16s本地WAV可以试听。新reference阻止旧来源Cover，转谱后本地reference任务无V1父版本。 |
| 可访问操作/隔离 | 三条guided路径以实际按钮驱动；模式路径可reset/transcribe/select/switch/reselect/inspect。English+dark实际生效，390px document和Player均390px，无横向溢出。requests仅owned18084静态GET/Blob，0业务请求；serverPOST=405、allowlist外路径=404、CSP connect-src none。 |

初次 `agent-browser eval` 复杂双引号被 Windows 原生参数处理，记录两个 SyntaxError；改用 Base64 包装后读回媒体事实。31条核验首次最后guided项因两个select按钮被同一locator匹配而strict失败，前29条已通过；修正locator明确首项，并将第二步标签显示为“5 · 选定 melody 输入”，最后31条通过。原始失败保留，未放宽产品等待或隐藏失败。原型只支持简单双声部方言；正式完整校验、mode capability和真实GPU两模式结果由后续票据交付。

## 服务所有权与交接

自有 Node PID `47140`，birth `1791458868.978`，parent `29216`，exec session `22179`，实际 command 为此 worktree 的 `docs/previews/cover-v1/serve.mjs`，仅监听 `127.0.0.1:18084`。HTTP200和CSP已读回；旧18032、18072均无监听。共享8188未操作。Root独立审阅及用户确认期间保留该服务，停止前再次核对PID、birth、脚本、端口。

源码最终全SHA、文件hash和最终HTTP/source核对由冻结交接读回；确认记录须指向实际服务源码。用户尚未确认本次 #43 Cover；旧布局确认与 #39 的“认可，继续正式实现”不替代本票新流程确认。
