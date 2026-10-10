# 移动创作工作台与电脑配对入口验证（M4）

日期：2026-10-10。实施票据：#103，父规格：#99（SPEC-017）。本记录是维护证据，不是公开教程。界面沿用已确认的 [移动工作流预览](../ui/mobile-workbench-preview.md)。

## 来源与边界

- 工作目录：`D:/Projects/Backend/llm-music-worktrees/issue-103-mobile-workflow`，分支 `issue-103-mobile-workflow`。实施起点为 M3 合并 `0955aef9851fb5a344fa34241c1be4c28887cbb1`，后续快进至标题草稿接口合并 `833168c4595f2c8ddf1531d3e2015602c94516b8`。
- 正式路径是 `/workbench`、项目详情和已保存 Version 详情。`/preview` 继续隔离模拟数据。手机创作操作只调用 M3 session；输入使用原有 SQLite 文档，Project/Version 未提交名称也使用 M3 标题草稿接口。
- 不引入第二套任务、请求恢复或保存领域。生成完成产生 Candidate，只有明确命名保存才产生 Version。结果未知先读原请求，用户明确继续时才重发原冻结意图。
- 播放界面通过 `WorkbenchPlaybackProvider` 接受 M5 的公共 controller/state。M4 单独运行时说明原始音频不可用；这不表示音频、物理设备、APK 或真实 GPU 已验收。M5 与最终集成验证单独记录。
- 电脑入口仅在原有 `/settings` 追加配对面板；颜色和样式限定于该面板，复用原有语言偏好。owner CSRF 仅在 mounted controller 闭包中，公共 snapshot 不包含它。短码只保留在当前面板内存，不写 URL、日志或持久存储。

## 自动检查

在上述工作目录执行：

```powershell
pnpm --filter @llm-music/mobile test
pnpm --filter @llm-music/mobile check
pnpm --filter @llm-music/mobile check:test
pnpm --filter @llm-music/web check
pnpm docs:check
git diff --check
```

实际结果：移动端全集 **37/37**，应用与测试 TypeScript 通过，Web Vite 构建与 TypeScript 通过，diff 检查通过。37 项包括 M3 的 26 项、M4 创作行为 7 项和电脑管理行为 4 项，不包含 M5 媒体测试。

文档检查实际通过：生成 62 个双语页面，15/15 行为测试，Astro 19 个文件检查为 0 error / warning / hint。首次运行因独立 worktree 的 API 环境尚未安装而缺少 `music_api`；执行 `uv sync --project services/api --frozen` 后重跑通过，未启动 API 或更改锁文件。

新增行为测试通过实际 M3 session 与生成客户端观察 HTTP 结果；仅替换外部存储和传输提供者。覆盖：未知 Generate 后继续编辑仍核对冻结原输入；Project 名称校验；取消终态后明确 retry；确认 Job 尚未进入索引时禁止另建请求；Version 列表未知时禁止保存；已确认保存不会被旧索引抹去；未知保存的明确继续先 GET，有原 Version 时 POST 0，无原 Version 时只 POST 原冻结名称。配对测试覆盖未知窗口回复、bodyless 204 关闭、CSRF 失效的只读恢复和单设备撤销。

## 桌面真实浏览器与 producer

使用独立 `agent-browser` 会话 `m4-desktop-103`，实际 Web `http://127.0.0.1:18702/settings`。其代理连接 Root 管理的隔离 Fake Runtime API：本地 `http://127.0.0.1:18700`，实际 LAN `http://192.168.31.209:18701`。API 进程、数据库和监听由 Root 管理；本测试仅撤销自己生成的 UUID 设备。

正常旅程实际通过：UI 开启短码；LAN 错码 403、正确 claim 201；设备出现在真实列表；关闭新窗口后新 claim 410，原设备业务 GET 仍为 200；撤销本测试设备后其新 GET 为 401，撤销记录保留。原有设备在此旅程前后保持一致。永久设备 token 只在测试 Node 进程内存中，未写文件或输出。

故障旅程实际通过：测试 Vite 中间件仍将 POST 发送至真实 producer，仅替换 CSRF 或截断回复正文。失效 CSRF 返回实际 403，界面 GET 重读、窗口不变，明确第二次点击后才重新 POST。真实 POST 201 接受后丢失回复正文，界面隐藏旧码、说明结果未知并 GET 原窗口；6.5 秒观察期仅有一个 POST。重载界面不能恢复明文码，也不会再 POST。新码自然等待完整有效期后，界面不显示短码，实际 LAN claim 返回 410，没有自动续开。

读取失败使用开发浏览器网络中断：已有 4 条真实设备记录保留，管理写入禁用；重新加载后初始读取失败没有声称窗口已关闭或设备为空。恢复网络后周期 GET 恢复列表，POST 0。中文和英文在 390×844 视口核对，文档无横向溢出，面板按钮均位于视口宽度内。已查看真实 viewport 截图并对照确认预览的黑色、酸黄强调和操作语义。

本地可复查证据位于该 worktree 的 `.scratch/m4-desktop/`（不入 Git）：

- `normal-journey.mjs`、`normal-journey-receipt.json`：正常 HTTP/UI 旅程。
- `fault-journey.mjs`、`fault-journey-receipt.json`、`fault-requests.ndjson`：403、201 回复丢失、重载与真实过期；请求日志只含时间、路径、状态和公开资源 ID。
- `read-layout-journey.mjs`、`read-layout-journey-receipt.json`：缓存/初始读取失败、GET 恢复及窄屏尺寸。
- `cached-read-failure-viewport.png`、`initial-read-failure-viewport.png`、`expired-recovered-viewport.png`、`narrow-en-pairing-viewport.png`、`narrow-zh-pairing-viewport.png`：已查看的真实 viewport 画面。
- `web-owner*.json`、`web-stopped*.json`：Web 自有进程 PID、出生时间、cwd、监听与正常退出记录。

## 原生协作证据与审阅修复

Root 已运行 Android Expo Go + Maestro 的真实 Fake API 创作闭环：未提交 Project 名称冷启动恢复 → 新建 Project → 中文风格与多行歌词冷启动恢复 → 2 秒拒绝、5 秒提交 → Job/Candidate → 未提交 Version 名称冷启动恢复 → 明确保存 → 历史/详情。其收据在主工作区 `.scratch/mobile-implementation/m4-native-first-complete-receipt.json`。原生资源和最终集成由 Root 继续管理。

独立 Standards 审阅发现两项 P2：Version 初始未知/旧列表误当未保存；确认 Generate/retry 的 Job 尚未进入旧索引时可能另建请求。已修复，增加对应回归并由非作者重新检查。Project 保留直接读取的原 Job，确认资源缺席时显示待读取；已确认保存通过原 Version ID 精确读取名称。历史不能把此情况显示为 0 或空列表。耗时使用服务端 `updated_at - created_at`，界面标为“已记录耗时”，不根据手机时钟虚构运行秒数。

最终集成源的完整 Standards/Spec、Maestro、M5 试听、设备、APK、GPU、CI 和主分支回读由 Root 分别记录，不用本记录替代。

电脑管理的最终非作者 Standards 复核已完成：配对四个源文件、Settings wrapper 与配对测试共 6 个文件逐项 SHA-256 匹配冻结清单，0 个阻塞项；独立配对测试 4/4 和 diff 检查通过。该结果不替代最终移动端及集成 Spec 审阅。

本轮自有 Web PID 57676 已按记录的出生时间、cwd、命令和 18702 监听确认归属后正常退出；端口和进程均已读回不存在。仅关闭 `m4-desktop-103` 浏览器会话。共享 API 的 18700/18701 监听仍由 Root PID 26184 保持。

## 保留的失败与局限

- 首次浏览器 `find testid … click` 未触发点击，等待超时；改为真实 `data-testid` CSS 选择器后通过。首次原生名称定位在屏幕外，Root 保留失败并通过公共 testID 滚动完成后续流程。
- 首版故障中间件在响应头之前断开连接。Chromium 透明重试导致第二个 POST 201，界面未进入未知状态，断言超时。该失败保留于原始日志；最终故障在响应头后截断 JSON，准确覆盖应用对已接受未知回复的恢复。最终“不自动续开”结论仅涵盖应用行为与这一实际故障，不承诺浏览器底层不会对其他连接错误重试。
- 本机 `agent-browser screenshot <selector> <path>` 生成了空白裁剪图片，未作为视觉验收。无 selector 的真实 viewport 截图正常；最终证据仅使用上述已查看 viewport 图片。Windows `eval --stdin` 未可靠返回结果，复杂表达式使用文档支持的 base64 参数。
- 已做有限简化检查：保留 session/HTTP、原生控件、UI 读状态与媒体 controller 边界，未为减少行数合并不同恢复职责。没有更改 M3/M5 数据或媒体实现、Web 全局样式及 Runtime。

## 输入后立即提交的原生反例与修复候选

Root 在冻结 `40fcf487` 的实际 Go 流程看到 Version 输入框已显示“M4 原请求版本”，紧接保存却返回 `version_name_required`，Version POST 为 0。Project `61275d4e-1465-404d-bb08-9baf93f17b6f`、Candidate `69a5b260-28b2-453f-9cf3-2de152d38123` 的首轮失败收据和截图在主工作区 `.scratch/mobile-implementation/m4-unknown-save-first-receipt.json` 与 `m4-unknown-save-output/2026-10-10_205359/` 保留。早期冷启动恢复后的正常保存通过，不能覆盖输入后在同一 mounted scene 立即提交。

已用实际安装的 `babel-plugin-react-compiler` 1.0.0、React19 target 编译原 `useTitleDraft`：生成物仅按 stable session、kind/project/candidate、hydrated/server 依赖缓存 `getTitleDraft()`。M3 输入时更新文档并同步 `publish({})`，这些依赖保持不变，故名称仍是旧空串；M3 的订阅和原始草稿本身正常。修复候选使用 `useSyncExternalStore` 订阅原始标题 string/undefined snapshot，继续复用 M3 getter、SQLite、server/project/candidate 分区、存储失败与 context 切换边界。Library 与 Candidate 共用这个 hook；编辑原始文本不创建业务写入。

候选源的应用/测试 TS 与现有 37/37 Node 回归通过。原/新编译产物在本 worktree `.scratch/title-subscription/compiled-before.js`、`compiled-after.js` 保留；新产物从公开 store hook 得到标题值，getter 在每次 snapshot 读取时执行。原生回归 [title-input.yaml](../../apps/mobile/tests/maestro/title-input.yaml) 通过公开输入/创建/保存检查即时提交，不复制 getter 或编译器缓存实现。该新 flow 未由本作者执行；Root 将按新源 hash 在原设备复验，并记录实际 API 结果，不能把编译检查或已有数据层测试记为原生通过。当前媒体恢复位置方案仍待 M5 正式集成后独立实施。
