# 移动创作工作台与电脑配对入口验证（M4）

日期：2026-10-10。实施票据：#103，父规格：#99（SPEC-017）。本记录是维护证据，不是公开教程。界面沿用已确认的 [移动工作流预览](../ui/mobile-workbench-preview.md)。

## 来源与边界

- 工作目录：`D:/Projects/Backend/llm-music-worktrees/issue-103-mobile-workflow`，分支 `issue-103-mobile-workflow`。实施起点为 M3 合并 `0955aef9851fb5a344fa34241c1be4c28887cbb1`，后续快进至标题草稿接口合并 `833168c4595f2c8ddf1531d3e2015602c94516b8`。
- 正式路径是 `/workbench`、项目详情和已保存 Version 详情。`/preview` 继续隔离模拟数据。手机创作操作只调用 M3 session；输入使用原有 SQLite 文档，Project/Version 未提交名称也使用 M3 标题草稿接口。
- 不引入第二套任务、请求恢复或保存领域。生成完成产生 Candidate，只有明确命名保存才产生 Version。结果未知先读原请求，用户明确继续时才重发原冻结意图。
- 播放界面已通过 Root 登记的 Media Provider/Workbench bridge 接受 M5 的公共 controller/state。原始受保护 FLAC 经鉴权下载与字节校验后前台试听，暂停/seek和同记录位置恢复由 M5拥有。早期 M4 独立候选的“原始音频不可用”是当时边界；当前正式源已接入真实媒体。物理设备、APK 和真实 GPU 仍单独验收。
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

早期 M4 独立候选的移动端全集为 **37/37**（M3 26、M4创作7、电脑管理4）。实际集成行为回归现为 **68/68**：再包括 M5 controller24/SDK factory3、M4实时意图4。68项在 Source66行为层执行通过；后续 Source67 的局部 Native Field 修改已通过应用/测试 TypeScript、实际编译与 diff检查，相关效果由原设备流程验证。Web Vite 构建与 TypeScript 已通过，最后提交的 exact-head CI 仍需 Root 回读，不能以本地结果代替。

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

最终集成源的完整正常旅程、exact-head CI 与合并回读继续由 Root 管理；设备、APK、GPU在M6分别记录，不用本记录替代。

电脑管理的最终非作者 Standards 复核已完成：配对四个源文件、Settings wrapper 与配对测试共 6 个文件逐项 SHA-256 匹配冻结清单，0 个阻塞项；独立配对测试 4/4 和 diff 检查通过。该结果不替代最终移动端及集成 Spec 审阅。

本轮自有 Web PID 57676 已按记录的出生时间、cwd、命令和 18702 监听确认归属后正常退出；端口和进程均已读回不存在。仅关闭 `m4-desktop-103` 浏览器会话。退出时共享 API 的 18700/18701 监听仍由 Root PID 26184 保持；后续 Root 原生重启与资源状态分别按其日志追踪，此段不是当前仍运行进程的声明。

## 保留的失败与局限

- 首次浏览器 `find testid … click` 未触发点击，等待超时；改为真实 `data-testid` CSS 选择器后通过。首次原生名称定位在屏幕外，Root 保留失败并通过公共 testID 滚动完成后续流程。
- 首版故障中间件在响应头之前断开连接。Chromium 透明重试导致第二个 POST 201，界面未进入未知状态，断言超时。该失败保留于原始日志；最终故障在响应头后截断 JSON，准确覆盖应用对已接受未知回复的恢复。最终“不自动续开”结论仅涵盖应用行为与这一实际故障，不承诺浏览器底层不会对其他连接错误重试。
- 本机 `agent-browser screenshot <selector> <path>` 生成了空白裁剪图片，未作为视觉验收。无 selector 的真实 viewport 截图正常；最终证据仅使用上述已查看 viewport 图片。Windows `eval --stdin` 未可靠返回结果，复杂表达式使用文档支持的 base64 参数。
- 已做有限简化检查：保留 session/HTTP、原生控件、UI 读状态与媒体 controller 边界，未为减少行数合并不同恢复职责。没有更改 M3/M5 数据或媒体实现、Web 全局样式及 Runtime。

## 输入后立即提交的原生反例与修复

Root 在冻结 `40fcf487` 的实际 Go 流程看到 Version 输入框已显示“M4 原请求版本”，紧接保存却返回 `version_name_required`，Version POST 为 0。Project `61275d4e-1465-404d-bb08-9baf93f17b6f`、Candidate `69a5b260-28b2-453f-9cf3-2de152d38123` 的首轮失败收据和截图在主工作区 `.scratch/mobile-implementation/m4-unknown-save-first-receipt.json` 与 `m4-unknown-save-output/2026-10-10_205359/` 保留。早期冷启动恢复后的正常保存通过，不能覆盖输入后在同一 mounted scene 立即提交。

已用实际安装的 `babel-plugin-react-compiler` 1.0.0、React19 target 编译原 `useTitleDraft`：生成物仅按 stable session、kind/project/candidate、hydrated/server 依赖缓存 `getTitleDraft()`。M3 输入时更新文档并同步 `publish({})`，这些依赖保持不变，故名称仍是旧空串；M3 的订阅和原始草稿本身正常。修复候选使用 `useSyncExternalStore` 订阅原始标题 string/undefined snapshot，继续复用 M3 getter、SQLite、server/project/candidate 分区、存储失败与 context 切换边界。Library 与 Candidate 共用这个 hook；编辑原始文本不创建业务写入。

修复源的应用/测试 TS 与当时 37/37 Node 回归通过。原/新编译产物在本 worktree `.scratch/title-subscription/compiled-before.js`、`compiled-after.js` 保留；新产物从公开 store hook 得到标题值，getter 在每次 snapshot 读取时执行。原生回归 [title-input.yaml](../../apps/mobile/tests/maestro/title-input.yaml) 通过公开输入/创建/保存检查即时提交，不复制 getter 或编译器缓存实现。Root 原设备即时 Project 创建与即时 Version 保存实际通过；后者 POST201 的 name 为“M4 即时输入版本”。上述公开 flow文件与 Root 对应执行脚本分别保留，不把新增文件视为作者运行记录。媒体恢复位置也已随 M5 注册实现，原序列反例与实际原生证据保持分开。

## 已集成媒体与实时意图读取

标题修复已作为 `bdae8de` 保存，再真实合入 M5 的 integration `7d21d9a2137caaa6fbbe9bab1fc64f6bb9131456`，得到 M4 合并起点 `8853ba8dbe88461f6796f39a56522850d23a470c`。Root 在 Session Provider 内登记唯一 Media Provider 和公共 Workbench bridge；PlayerPanel 仅切换不同记录时 select，同记录的后台/错误恢复与 ended 重听交给 M5 play，保留控制器的实际位置。公开 M3/M5 controller 的序列反例曾显示当前 UI 重选后 0≠12，候选续播保留12；这是外部 provider 回归，正式 UI/原生结果继续由 Root 单独记录。

Root 的原设备即时 Project 输入/创建与即时 Version 输入/保存已经通过，Version POST201 body 的名称为“M4 即时输入版本”。随后真实 producer 接受保存201但回复丢失503，旧 CandidateCard 仍显示“尚未保存”、可编辑字段和新保存按钮；意图 Card 缺席。该失败没有第二次保存：后台仅 Generate1/Save1，Version已存在。截图和日志在主工作区 `m4-unknown-save-title-fixed-output/2026-10-10_211926/` 保留。

实际 compiler1.0.0/React19 产物确认 CandidateCard 对 `session.listIntents().find()` 的缓存只依赖稳定 session 与 Candidate ID；Library 的旁路渲染可能暂时掩盖同类读取，Project 渲染守卫内部也读取可变意图。新 `useCreatorIntents` 订阅一个随 M3 fresh SessionSnapshot 身份失效的只读派生 view。未变化时返回同一个数组，避免直接 `listIntents()` 的每读新数组触发 React 无限更新；文档、信号和所有意图仍由 M3 拥有。Candidate、Project 生成/历史和 Library 都消费该 snapshot。渲染守卫是纯数组计算；点击时的 Generate/retry/save 守卫继续读取当次 facade，防止捕获旧意图数组。没有强制刷新、第二套持久化或 schema 变更。

未知保存显示“保存结果待确认”，冻结原名称并保留原保存核对入口。历史有 prepared/unknown 保存时显示待确认，不能把旧 `[]` 说成0或空历史；已确认 resource ID 的精确读取边界保留。Library 有待确认创建时也不声称项目为空。

新增公开 store 回归使用真实 M3 和外部 HTTP/存储：no-save→prepared→503 unknown→GET confirmed（保存 POST1）、生成/retry 在未变化旧 Job index 中仍阻止另一次事件、Library 收到未知 Project 且禁止第二请求。重复 snapshot 读取稳定；编辑新名称不改冻结保存名称。4/4 新回归、集成移动端全集 **68/68**、应用/测试 TS 与 diff 检查通过。原/新 Candidate/Library/Project 编译产物在 `.scratch/intent-subscription/` 保留。首轮新测试 fixture 多写了 JobRead 未声明的 source_job_id，TS失败后已按生成契约修正；未放宽类型检查。Root 对 Source66实际 live None→unknown、原名称冻结、旧空历史不冒充0和明确GET恢复已经通过；具体原生/API收据见下文，与 Node或编译产物分开。

## Compose 输入生命周期的原生反例与局部修复

Root 后续在 Server B 的实际 Project 点击填入示例/生成时得到 `ExpoUI_BasicTextFieldView` 的 `value` 属性错误：`Cannot use shared object that was already released`。本轮尚无 Generate POST，后台 accepted/Job列表为 `[]`。首轮 LogBox、logcat 和原 Maestro 失败保留于主工作区 `.scratch/mobile-implementation/m4-cancel-retry-output/2026-10-10_222253/`，先前标题、未知保存、播放/拖动和撤销通过结果继续保留。

已核对安装的 `@expo/ui`57.0.22 与 `expo-modules-core`57.0.21：universal Android TextInput 把 defaultValue 捕获在 useRef，useNativeState 使用空依赖，故“每次 defaultValue变化就重建对象”预测被实际 SDK 源证伪。其 BasicTextField 把 ObservableState 编码为 SharedObject ID；对象在 owner unmount释放。原 fill-example 同时改变四个 Field key，明确进入 teardown/recreate 边界；这支持保留同 scene 控件身份的探针，并不独自证明 SDK 内部根因。

局部候选使用 SDK 文档支持的 `value: ObservableState<string>`：Field 持有稳定 useNativeState，只在明确 replacement signal 改变时调用 `state.set(initialValue)`。普通 typing/HTTP/intent渲染不 set、不改 cursor/composition；填示例、清名称、冻结保存名使用 signal，避免同一记录的 revision key-remount。真正 Scene 的 SID+Project key 与名称的 SID/Project/Candidate key 保留，设备更换不另建草稿。没有改 SDK/Core、依赖或全局 compiler，也没有替换为整体 RNInput。实际 compiler 前后产物还确认当前 ProjectScene 逐 render 读取 getDraft，没有隐藏缓存；Generate 继续从 M3 草稿准备原输入，避免依赖异步 NativeState.set 的时间。

修复应用/测试 TS 与 diff检查通过。Root 运行公开 [fill-example.yaml](../../apps/mobile/tests/maestro/fill-example.yaml) 的 custom-edit→明确替换探针，进程98147 exit0，可见文本正确、无原 value ConsoleError、无POST；随后同一 Server B 的实际 Generate/Cancel/Retry 覆盖已经通过下文边界。新绿结果验证该场景的局部修复，不推断 SDK 内部根因已经穷尽。

## 当前冻结源的原生结果与交付边界

本轮产品源保持 `.scratch/m4-native-field-candidate-hashes.json` 的67项 hash；HEAD为 `8853ba8` 加最终未提交 delta，Source66的相关场景在先，Field delta的 Source67场景在后。最终 source+doc清单随 WIP提交保存，未因文档记录改变产品源。

- **实时未知保存（Source66）：** `.scratch/mobile-implementation/m4-live-save-unknown-receipt.json` 和 `m4-live-save-recovered-receipt.json`。Project `1143b04c-0a22-4e15-862c-50c4c6fb6712`，实际 Version `ffea3b7d-68ed-4a4e-bab9-38a52fe5f528`。producer接受201/回复丢失503后，正式 UI live显示未知与冻结原名；旧空index不声称0/空历史。明确核对后 GET 原 Version，保存POST累计1，无重写或改名。
- **取消及原输入明确重试（Source67）：** `m4-cancel-retry-final-receipt.json`。Server B Project `8383348b-0065-4204-9d10-893515d90c24`，原 Job `861e4de5-d2d6-45ea-a2df-6cda3387d71c` cancelled，新 Job `186ffb83-0945-48ff-9176-111b0f61e5bc` completed且retry_of为原ID；两者 frozen inputs深等，保留原中文style/完整多行歌词/seed42/max_seconds0，Runtime accepted2。原完整runner在后续 draft编辑 exact-text断言失败：截图保留旧suffix；Root根据实际新marker核对后 remainder50106 exit0。不是产品修改，也没有把原runnerexit1改成通过。编辑draft只观察原生公开内容，未导出私有store充当UI证据。
- **实际原始音频与授权：** Source66的正式 Candidate/Version 页面完成真实 M5原FLAC试听、暂停、seek/拖动、后台不自动续播与授权失效后的暂停/禁止新动作；对应 Root 的 `m4-full-player-*.yaml/.log`、`m4-active-revoke-receipt.json` 和 [媒体核验](mobile-audio.md) 记录各自实际namespace/hash。HTTP200/HEAD/206/416与原字节，SDK controller和UI拖动各自证明，不把本地seek称为服务器Range。
- **新授权后的同SID草稿恢复（Source67）：** `m4-return-a-submit.log`，终态86308 exit0。实际重新授权电脑 A `http://192.168.31.209:18708`，原中文style/完整多行lyrics在正式Project页面恢复。此前 return-A准备将401预期为revoked，但M3 pair的prepared错误路径显示disconnected；实际服务/device401、已选A。随后cold verify读取已有paired凭据显示revoked，fresh PIN UI成功。原失败及现有行为保留，未修改M3。该结果不冒充每个错误路径都即时显示相同标签。

以上日志和收据在 Root 主工作区 `.scratch/mobile-implementation/`，只读来源未导出设备token或owner CSRF。Source67 Field的67/67、实时意图66/66独立 hash复核与 changed-scope Standards/Spec均0未解决源码项；实际compiler产物由非作者逐字复核，公开M3投影视图阶段/稳定snapshot/跨SID probe也通过。源码结论不替代原生或最终CI。

**历史候选阶段的待验状态：** 当时 Source67最后整段公开正常旅程及最终CI/合并回读尚未完成。正常runner首轮preflight因PS5 Byte[]/缺ContentType对/status误判而停止，Maestro未启动、POST0。随后runner5392在command24对新空歌词执行eraseText10000超过120秒而exit1，尚无Generate；Root已定位为runner操作预算并修正。这两次失败继续保留，不改Field67产品源，也未计为整段正常旅程通过。

**2026-10-11 后续回读：** 最终产品候选 `4da443926efe6744a3fe21ecb500e1f5d91d6f63` 保持67项已审查内容。公开 Go 正常旅程及持久对象回读通过，最终适用CI全部通过，[PR #110](https://github.com/CaiZongyuan/llm-music/pull/110) 实际合并为 `a842aedd84220957dd03d0562bc25234c7229d95`，#103/#104 已关闭。独立APK、真实GPU和物理Android继续按M6分别记录，实际进展见 [Android交付核验](mobile-android-delivery.md)；不能将M4完成视为物理设备已验收。
