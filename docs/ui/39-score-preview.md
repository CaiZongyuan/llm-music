# #39 Score 编辑与重新生成预览记录

- 票据：[#39](https://github.com/CaiZongyuan/llm-music/issues/39)，父规格 [#9](https://github.com/CaiZongyuan/llm-music/issues/9)，关联 #8 / #6。
- 起点：实际 main `711df508dd0edead070f4345a7b23eb9c6834e77`。原生 blocker 只有 #38，已 closed / PR #84 merged。
- Owner：`/root/score_preview_developer`。独立分支 `p3/39-score-preview`、worktree `.worktrees/39-score-preview`。
- 预览：[score-editing-v1](../previews/score-editing-v1/README.md)。自有 <http://127.0.0.1:18072/llm-music/score-preview/>。
- 状态：**可运行并已由作者真实浏览器核对；等待 Root 独立审阅和用户本次具体体验确认。确认前不实施 #40 的正式交互。**

## 复用与待确认决策

复用 [#31 最新确认](31-web-mvp-preview.md) 的 Project Workspace、侧栏与持续 Player；落实用户“认可，需要中英双语，亮暗模式”。本票沿用该布局，不要求重选总体设计。用户随后“关闭预览吧”仅关闭旧 18032；该端口保持无监听，本票使用新 owner / 新端口。

待确认的具体路径：编辑 ABC → 对照真实谱面与派生 MIDI 试听/导出 → 明确选定有效 Score → 模拟 GenerateFromScore → 试听 Candidate → 明确保存带父版本的新 Version。用户能否清楚识别当前草稿、已选定 Score、本次任务的实际提交输入、旧 Version 与未保存 Candidate。

草稿修改后必须检查并重新选定才可再生成；已有选定快照可检查，但不能被变化后的草稿悄悄替换。运行中的输入与保存结果在提交时冻结。原始 V1 始终只读，恢复原版本只修改草稿。模拟生成/保存与真实数据库、API 和 Runtime 隔离。

主路径采用创作语言；使用说明面向改旋律、试听判断和探索风格。没有 Swagger 录屏、GPU 操作或正式 Web 改动。

## 作者验证

2026-10-08，作者先使用隔离 `score39-developer` agent-browser Chromium session，再使用独立 acceptDownloads Chromium context 从公开 UI 执行 34 条结果事实。浏览器使用软件渲染，桌面 1440 × 960、窄屏 390 × 844。一次性核验脚本和原始事实保留在本 worktree 的 `.scratch/39-score-preview/`，不新增产品测试。

| 范围 | 实际证据 |
| --- | --- |
| 编辑与谱面 | 合法 ABC 实际生成一个 SVG；修改会重新解析。无效 `C ? D` 保留文本并显示 Music Line / Col 定位。渲染失败保留上一份有效谱面且明确它已过期，禁止试听/导出/选定当前错误草稿；重试恢复。 |
| MIDI 原生下载 | 两次 UI 下载均完成，`failure=null`，各 298 B。原始 SHA256 `fde7eb774afba95746d6ae48290e29536e061dbe05a36416cf5133bab36c810f`，修改后 `c823895d7dd9cc092daa467be9bd4499638fc3baf585be0bc03425854a2dc621`。独立现有应用 MIDI 验证器读取两份完整 SMF，均有 22 个 note-on；独立解码首音高从 `[60,62,64,65]` 变成 `[67,69,71,72]`。 |
| 派生 MIDI 试听 | 两份实际 WAV 都是 10.2 s，播放器 currentTime 前进、paused=false、error=null。独立波形零交叉检查首音频率约 266.7 / 393.3 Hz，对应 C4 / G4 的 261.6 / 392.0 Hz；两份 WAV hash 不同。Player 在 Score→歌词→版本时继续播放，只有一个 audio 元素。 |
| 草稿与提交竞态 | 明确选定后，任务 queued/null progress，继续修改草稿；已选定 ABC 与任务实际输入仍保留前一份内容与 `preview-version-1` parent。当前 dirty 草稿不能新提交，必须重新检查选定；暂停运行期间可以检查并完成原任务。 |
| Candidate 与 Version | 完成只生成 Candidate，版本仍一项。保存失败保留名称与 Candidate，重试产生一个新 Version；再次点击已保存结果进入同一快照，不重复保存。新 Version 的 ABC 为任务提交内容，带原 V1 parent；原始 V1 逐字保持原例。 |
| 生成失败与取消 | 生成失败保留文本、旧 Candidate/Version。retry 创建新 Job，输入与失败任务快照相同。queued/running cancel 均无新 Version；取消完成竞态显示 completed 及未保存 Candidate，仍不自动保存。 |
| 失败与状态 | 可执行谱面、试听、导出、生成、保存失败；均保留文本和旧数据。无 Score 可打开示例恢复，加载期间禁提交且随后恢复同一草稿；无效 seed 在提交前拒绝。实际刷新重置模拟内存，未声称业务持久恢复。 |
| 双语、主题、窄屏 | English / dark 实际生效；中文亮色切回可用。390 px 下 document 与 Player 均为 390 px，无整页水平溢出。 |
| 隔离 | 0 uncaught page errors。浏览器请求只出现 owned 18072 静态 GET 与本地 Blob；无业务通信。服务 POST 拒绝，allowlist 外路径拒绝，旧18032无监听。 |

初轮发现并修复了 detached abcjs 响应式容器样式丢失导致谱面溢出、中文亮色标签缺译；均重新实际核验。PowerShell 原生 CLI 对复杂 JS 引号的传递导致一次等待超时，改用 Base64 / 已观察定位；检查脚本的依赖相对路径和预估音符数先写错，改为正确工作区入口与实际 22 个音符。CSP `connect-src 'none'` 正确阻止核验脚本 fetch Blob，改用浏览器原生 Blob 下载提取试听 WAV，未放宽产品 CSP。原始失败记录保留，未改写成全部首轮成功。

有范围的简化检查涵盖本票全部新增源码及既有布局/谱面入口：保留纯内存 snapshot 模型与媒体副作用边界；复用一套 Player、一个 MIDI 派生路径和历史音频，不新增 production client/schema、重复样本二进制或测试框架。解析警告通过文本处理进入错误区，不插入第三方警告 HTML。最后修改后 34 条浏览器事实再次通过，语法检查与独立媒体检查通过。独立标准/规格审阅由 Root 执行。

## 服务所有权与交接

自有 Node PID `55788`，实际 process birth `1791433767.184`，exec session `10552`，监听 `127.0.0.1:18072`，脚本为本 worktree 的 `docs/previews/score-editing-v1/serve.mjs`。运行身份、冻结提交、文件 hash、HTTP/原始 browser/media 事实另存 owned `.scratch/39-score-preview/`。用户确认期间保持该自有服务可访问；停止前必须再次核对 PID、创建时间、脚本和端口。共享 Runtime 8188 未操作。

## 用户反馈与确认

尚未收到本次 Score 编辑/重新生成体验确认。Root 应针对已冻结、可操作版本提出具体确认并记录用户原话、所确认提交和后续纠正；旧 #31 布局确认不代替本次 #39 新流程确认。确认后才可交由新的 Developer 实施 #40；#41 API 可独立继续。
