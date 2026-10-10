# 移动端 API 与局域网接入草案

日期：2026-10-10。状态：用户已确认完整预览与接入真实后端；正式规格 [SPEC-017 #99](https://github.com/CaiZongyuan/llm-music/issues/99) 及实施票据已发布。本文件保留源代码兼容评估与技术提案，实际接口以实施后的 Pydantic/OpenAPI 为准；当前尚未将接口准备计为实现或 GPU 验收。

已确认范围来自 [移动端访谈](mobile-interview.md)、[生产规划](../production.md)、[ADR-005](../adr/0005-mobile-companion-scope.md)、[ADR-006](../adr/0006-mobile-lan-pairing.md) 和 [领域定义](../../GLOSSARY.md)：Android 便携客户端、局域网手工配对、前台试听、手机保留 Creation Draft、后端继续生成、返回时恢复 Job、明确保存 Candidate 为 Version。保留 Web；iOS 的开发连接成功不扩大正式验收范围。

核查基线：`1ce3268577c4fc25f533b5f01993b608bf5cf267`，同时读取当前工作树的实际消费者。工作树有大量既有 Web 改动，本草案没有修改这些文件。以下“现状”均为源码检查结果；“建议”是待实现选择，不表示接口已可用。

## 已有闭环与真实缺口

| 手机操作 | 当前正式接口 | 现状与移动端约束 |
| --- | --- | --- |
| 项目列表、新建、打开 | `GET /projects`、`POST /projects`、`GET /projects/{project_id}` | 新建返回 201；每次成功 POST 都生成新 id，没有客户端幂等键 |
| 检查生成可用性 | `GET /health`、`GET /runtime/capabilities` | 既有 Runtime 观察与 readiness；提交时后端仍重新核对，不能靠手机缓存放行 |
| 根据风格/歌词生成 | `POST /projects/{project_id}/jobs/generate` | 返回 202 `JobRead`；每次 POST 新建 Job/attempt，没有精确的客户端提交恢复标识 |
| 任务列表、详情、返回恢复 | `GET /projects/{project_id}/jobs`、`GET /projects/{project_id}/jobs/{job_id}` | HTTP 是状态恢复来源；保留 queued/running/completed/failed/cancelled 和 recovery/cancel 字段 |
| 取消 | `POST /projects/{project_id}/jobs/{job_id}/cancel` | 接受意图不等于已取消；可能 202，只有确认后的终态才显示已取消；终态重复取消保留原记录 |
| 明确重试 | `POST /projects/{project_id}/jobs/{job_id}/retry` | 只允许 failed/cancelled 且原 Runtime 尝试已安全终止；成功产生新 Job，`provenance.retry_of_job_id` 指向原任务，不覆盖原输入/结果 |
| 实时观察 | `WS /projects/{project_id}/jobs/{job_id}/events` | `job.updated` 含完整 `JobRead`；首次发送持久快照；完成后关闭；当前没有鉴权 |
| 查看候选结果 | `GET /projects/{project_id}/candidates`、`GET /projects/{project_id}/candidates/{candidate_id}` | 完成的生成通过 `JobRead.result.candidate_id` 找到 Candidate；完成不自动创建 Version |
| 前台音频试听 | `GET /projects/{project_id}/assets/{asset_id}` 及 `/content` | 元数据及原始 FLAC；当前 content 使用 `FileResponse`，只有 GET 路由，没有 HEAD 路由，也没有设备鉴权 |
| 命名保存、版本历史 | `POST /projects/{project_id}/versions`、对应列表/详情 GET | 已按 candidate_id 保证同一 Candidate 一次保存；相同 name/parent 重发返回原 Version（200），不同意图返回 409 |

来源：[HTTP 注册](../../services/api/src/music_api/main.py)、[生成注册](../../services/api/src/music_api/generation.py)、[JobService](../../services/api/src/music_api/jobs.py)、[WS](../../services/api/src/music_api/event_routes.py)、[候选/版本接口](../../services/api/src/music_api/version_routes.py)、[保存事务](../../services/api/src/music_api/versions.py)。移动首版不新增转谱、Cover、乐谱编辑、上传或分享流程。

### 输入与进度保持最新契约

- `style` 去首尾空白后 1–1024 字符，`lyrics` 1–10000 字符，保留中文和多行结构。`seed` 是严格整数，后端范围 0–`2^63-1`；当前 TS client 映射为 number，移动端创建输入只接受 0–`Number.MAX_SAFE_INTEGER`，默认值可沿用 Web 的 42。历史 seed 超出安全整数范围时，不把解析后的近似值拿来重发；本轮不缩窄后端历史契约。
- [规格 #97](https://github.com/CaiZongyuan/llm-music/issues/97) 已落到源码：`max_seconds` 默认 0，API 接受 0–360；手机“自动”/空输入提交 0，手工引导 5–360，1–4 在 UI 拒绝但不改写 API 合法范围。显示“时长上限”，不承诺精确时长；冻结提交、重试、Candidate/Version 快照都保留原值。
- 进度从现有 `phase/status/progress` 读取。`progress=null` 就显示已确认阶段，不生成整任务百分比或预计剩余时间。[#98](https://github.com/CaiZongyuan/llm-music/issues/98) 是独立 Web 体验草案，不能把其示意序列当成已交付的新后端字段。当前 Generate 阶段包含 `loading_model → planning_score → generating_semantic → synthesizing → decoding_audio`，另有 preparing/saving；失败时 phase 可能为空，应展示实际错误而非推测失败步骤。

来源：[生成 schema](../../services/api/src/music_api/generation_schemas.py)、[当前 Web 输入](../../apps/web/src/features/generation/drafts.ts)、[Job schema](../../services/api/src/music_api/schemas.py)、[phase 登记](../../services/api/src/music_api/jobs.py)。本轮没有修改 #97/#98 或重做其验收。

## 建议：一个业务进程、两个明确绑定的入口

默认启动保持 loopback；只有显式开启 LAN 才额外监听选定的本机 WLAN IPv4，例如 `127.0.0.1:8000` 与 `192.168.31.209:8001`。地址、端口是示例，不能写死当前 DHCP 地址；绑定前核对地址实际属于本机网卡，首版不使用 `0.0.0.0`、`::` 或自动选择虚拟网卡。

两个 socket 交给同一个 `uvicorn.Server.run(sockets=[...])`，只创建一个 `create_app`、一次 lifespan、一个 Database、JobService、Runtime adapter 与 event broker。禁止为 LAN 再启动第二个业务 worker，禁止两个 `create_app` 分别拥有同一数据库/GPU 队列。ComfyUI 继续绑定 loopback。局域网监听开关与设备授权是不同状态：停止新配对后，已配对设备仍可访问；关闭 LAN 则停止整个远程入口。

本机锁定 Uvicorn 0.54.0 的 startup 先启动一次 lifespan，再逐个建立传入 socket 的 listener；HTTP/WS `scope.server` 来自实际 transport 的 socket 本地地址。可据此按配置中的确切地址/端口区分 loopback 与 LAN，未识别地址拒绝访问。不要依据 `Host`、`Origin`、`Forwarded`、`X-Forwarded-For`、客户端声称的 IP 或“我是本机”标记授予本地权限。LAN 运行不信任代理头；本轮不部署可从 LAN 转发到无凭据 loopback 的代理。

来源：[依赖锁](../../services/api/uv.lock)、[Uvicorn Server](https://github.com/encode/uvicorn/blob/0.54.0/uvicorn/server.py)、[Uvicorn 地址获取](https://github.com/encode/uvicorn/blob/0.54.0/uvicorn/protocols/utils.py)。这是可实现的静态证据，双 socket 在 Windows 的真实启动、退出和鉴权行为仍须验证。

在启用 LAN 的进程中，本地 Web 继续访问原 loopback `/api` 代理及无设备凭据的业务契约；LAN 对所有业务 HTTP、WS、Asset 请求验证设备凭据，包括 health、diagnostics、OpenAPI，避免只保护手机界面使用的几个路由。默认 local 模式与现有 CPU fixtures 保持行为。LAN 模式的鉴权测试必须使用真实 socket，未知 ASGI server 地址不能默认为 loopback。新增电脑配对管理写操作只允许 loopback，并需防跨站请求；建议使用本地读取的随机 owner CSRF token 和受控 Web Origin，二者不替代 socket 身份判断，不开放跨站 CORS。

## 建议：短码换取可撤销的单设备授权

以下路径/字段用于预览与实施规划，尚不存在：

| 入口 | 允许访问者 | 行为 |
| --- | --- | --- |
| `GET /connection` | LAN 可匿名 | 仅返回稳定 server_id、名称和配对是否开放；不返回项目、Runtime 信息或凭据 |
| `POST /pairing/challenges` | 本地 owner | 生成唯一活跃的 6 位数字短码，建议有效期 2 分钟、最多 5 次错误尝试；返回一次明文码与电脑地址 |
| `DELETE /pairing/challenges/current` | 本地 owner | 关闭当前配对窗口，不撤销已有设备 |
| `POST /pairing/claim` | LAN 可匿名但限流 | 手机提交 code、device_id、device_name、device_token；成功原子消费短码并登记设备 |
| `GET /device` | 有效设备凭据 | 返回当前设备与 server_id，用于启动确认及配对响应丢失后的核对 |
| `GET /devices`、`DELETE /devices/{device_id}` | 本地 owner | 查看授权摘要、撤销设备；LAN 上即使有合法设备凭据也不能管理其他设备 |
| 既有业务接口 | LAN 有效设备凭据；本地按既有契约 | `Authorization: Bearer <device_token>`，所有已配对设备访问同一单用户工作台 |

手机在 claim 前用原生安全随机源生成 32 字节 token 和 UUID device_id，并先存入 SecureStore；服务端只存 token 摘要及设备状态，不储存可恢复的明文 token。claim 的重复请求如果 device_id、token 和首次成功意图一致，返回同一设备摘要；冲突返回 409。这样响应丢失后可以用已保留凭据读取 `/device` 或明确重复相同 claim，避免生成第二份授权。非法、过期、已消费且不属于相同意图的短码分别给出可恢复错误，限流返回 429；错误次数与过期时间不能因 API 重启被重置。

设备表、短码摘要/期限/尝试次数、稳定 server_id 使用现有 SQLite/Alembic 所有权。device_id 和显示名称不是身份凭据；不引入用户账号、权限角色或第二套 Project/Job 数据。移除/丢失 SecureStore 时重新配对，电脑可撤销旧设备；不把卸载 Go/APK 当成可靠的服务端撤销机制。凭据不写入 URL、二维码、日志、分析事件或一般草稿存储。

撤销后新 HTTP/Asset 请求返回 401，活动 WS 关闭并停止推送；下次 Range/重连也重新鉴权。撤销设备不会取消已经由后端拥有的生成 Job。已经传送到手机的音频字节无法由服务端收回，不能承诺远程抹除本地缓存；手机观察到授权失效后暂停播放器并清理活动 handle，保留创作草稿。

SDK 57 的 [Crypto](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/) 和 [SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/) 包含于 Go，均为待接入依赖。上述 HTTP LAN 基线提供设备授权，不提供传输加密；首版仅在已确认的受信局域网显式启用，公网/TLS 部署另行规划。独立 Android APK 还须验证实际 cleartext/network security 配置，不能从 Go 的 LAN 成功推导为正式二进制已通过。

## 建议：给未知提交结果一个精确恢复标识

现有 Generate 的相同 style/lyrics/seed 仍可合法产生多个 Job，`attempt_id` 是服务器生成的内部 Runtime 身份，不是手机提交幂等键。现有 retry 的 `retry_of_job_id` 可帮助发现重试，但多次明确 POST 仍可能产生多个新 Job。新建 Project 也存在响应丢失后重复创建的问题。

建议对 Project 新建、Generate 与明确 retry 支持 `Idempotency-Key: <UUID>`；LAN 入口要求发送，缺少时返回 422，旧 loopback Web 可继续省略。首次请求前，手机持久保存 key、目标 server_id、项目/原任务及冻结输入；编辑 Creation Draft 不修改该提交意图。服务端在同一数据库记录请求 key、操作/目标、标准化输入摘要和产生的 resource_id；相同 key/相同意图返回同一资源，相同 key/不同意图返回 409。唯一键与 Project/Job 的创建必须在同一事务中提交，Job 只在提交后进入现有队列；不得把 receipt 写在另一个事务或只存内存。

新增授权的 `GET /requests/{request_id}` 返回已确认的资源引用，随后读取原有 Project/Job 接口。断网、超时、App 重启或 5xx 后先查询，禁止自动以新 key 重发；查询 404 时，原请求仍可能在途，不能把 404 当成自动新建许可。允许用户明确重发同一 key 与冻结输入，服务端幂等约束处理并发。取消沿用原 job_id 核对再明确重试取消，不产生新的 Job。

Version 沿用现有 candidate_id 幂等规则，不再引入第二个保存键。保存前保留 name/parent 意图；响应未知时先查询 Versions 按 candidate_id 核对。若已有 Version，显示其实际名称；若不同 name/parent 冲突，不覆盖旧快照。新设备凭据不改变单用户共享数据的拥有者。

## 原生 HTTP、WS 和音频

共享 [API client](../../packages/api-client/src/index.ts) 的 schema、`createMusicClient` 和 `jobEventsUrl` 是候选复用入口。手机使用绝对 baseUrl 与可更新的 Authorization middleware；现有 Web `/api`、`location.origin`、DOM player 不能直接复制。生成 Pydantic/OpenAPI/TS 仍走 [生成器](../../packages/api-client/scripts/generate.mjs)，新增鉴权、请求键与错误同步登记；条件安全策略按本地/LAN 解释，不能把无凭据本地访问误记为 LAN 匿名开放。现有 `x-websockets` 继续登记一个 Job channel。

RN 0.86.3 的 WebSocket 实现支持第三参数 `options.headers`，可在 LAN handshake 发送 Authorization，不需要永久 token query。WS 在查询/订阅 Job 之前鉴权；活动连接需关联 device_id，撤销时关闭。App 进入后台时释放观察连接、暂停首版前台播放器；返回前台先 HTTP 读取原 Job，再重连。连接消息与 sequence 只用于实时观察，不作为唯一数据库或永久 replay cursor。切换电脑时清理连接与 server-scoped Query cache，草稿和 pending intent 按 server_id/project_id 隔离。

`expo-audio@57.0.5` 的 `AudioSource.headers` 可给远程 uri 发送 Authorization；Android 源码将它设置到 `OkHttpDataSource`，iOS 使用 `AVURLAsset` HTTP headers。音频 URL 直接指向受保护 Asset content，不重定向到其他 origin，不把长期 token 改为 query。token/设备变化时重新创建 source，拒绝继续复用带旧授权的 player。

现有锁定 Starlette 1.7.0 `FileResponse` 已支持 `Accept-Ranges: bytes`、单/多 Range 的 206、越界 416、ETag/If-Range；但 FastAPI content 只注册 GET。建议增同一权限策略的 HEAD，保留完整 GET 的 200/MIME/字节内容与现有路径所有权检查，补充 OpenAPI 的 206/416。每一次 GET、HEAD 和 Range 请求都先鉴权；未授权请求不发送音频字节。真实 48kHz、双声道、16bit FLAC 的解码/seek、请求 header、加载失败和撤销后再 seek 都要用设备验证，不能由 HTTP 或 Maestro UI 通过替代。

来源：[RN 0.86.3 WS 实现](https://github.com/facebook/react-native/blob/v0.86.3/packages/react-native/Libraries/WebSocket/WebSocket.js)、[SDK 57 AudioSource](https://docs.expo.dev/versions/v57.0.0/sdk/audio/#audiosource)、[固定音频 Android 源码](https://github.com/expo/expo/blob/9e5319c0f821a27b7924841903abae50e2b41790/packages/expo-audio/android/src/main/java/expo/modules/audio/AudioModule.kt)、[固定音频 iOS 源码](https://github.com/expo/expo/blob/9e5319c0f821a27b7924841903abae50e2b41790/packages/expo-audio/ios/AudioUtils.swift)、[Starlette FileResponse](https://github.com/encode/starlette/blob/1.7.0/starlette/responses.py)。这些证明 API/代码路径存在，没有证明本项目设备运行结果。

## 真实消费者与验证安排

| 边界 | 当前消费者 | 实施时必须保住的事实 |
| --- | --- | --- |
| loopback 与监听所有权 | [CLI](../../services/api/src/music_api/cli.py)、[dev_api](../../scripts/dev_api.py)、[dev launcher](../../scripts/dev.py)、[进程检查](../../scripts/dev_process.py)、[launcher tests](../../tests/launcher/test_dev_launcher.py) | 默认地址/端口与 Web URL 不变；LAN 地址/端口进入 identity/signature/owner receipt；核对两处监听，同一进程复用/退出；未知端口或模式冲突拒绝启动，不能关掉用户服务 |
| Web 代理与无设备凭据 | [Vite](../../apps/web/vite.config.ts)、[Web client](../../apps/web/src/lib/api.ts)、[Job monitor](../../apps/web/src/features/jobs/monitor.ts)、[Candidate save](../../apps/web/src/features/candidates/Candidate.tsx) | `/api` HTTP/WS 仍走 loopback，已有 Generate/取消/重试/保存/音频行为保持；新增管理写操作有独立 CSRF 验证 |
| CPU 进程和故障注入 | [client fixture](../../packages/api-client/tests/run_api.py)、[client support](../../packages/api-client/tests/support.ts)、[browser runner](../../tests/browser/run_api.py)、[generation recovery](../../tests/browser/run_generation_api.py)、[API tests](../../services/api/tests/test_generation_cancel_retry.py) | 默认 local 模式兼容；不把所有老 fixtures 变成设备鉴权测试；新增 LAN fixtures 用隔离 DB、随机端口、Fake Runtime、真实 HTTP/WS/socket 和受控断连 |
| RN client 与本地状态 | [移动端初始化](../../apps/mobile/package.json)、共享 client | JSON 请求/错误/abort、headers、URL、AppState 恢复实际执行；SecureStore 与草稿存储分别验证，存储失败时禁止声称已保存凭据或继续不可恢复的提交 |

后续最小验收应覆盖：一次生命周期/一个 Job worker；未配对、错码/过期/限流、重放和重启；LAN 伪造 Host/Forwarded 仍无本地权限；HTTP/WS/Asset 全链路授权与撤销；Project/Generate/retry 同 key 并发、响应丢失、进程重启、不同输入冲突；取消未确认不冒称终态；Candidate 明确保存及同名/异名重发；Range 的 200/206/416、HEAD、原始字节与路径归属；默认 Web/client/launcher 兼容。

预览必须能执行配对/撤销、错误恢复、草稿修改与输入快照区别、未知提交核对、取消确认中、明确重试、试听失败/seek 与命名保存，并覆盖空/加载/失败。模拟凭据和数据隔离，不读取真实设备 token，不调用真实 API/GPU。用户确认后的实施再运行 OpenAPI/client、受影响 API/launcher/Web 检查与 Android Maestro；真机原生音频、独立 APK、真实 GPU 闭环作为分开的交付证据。本次只完成来源与兼容评估，没有执行这些验收。
