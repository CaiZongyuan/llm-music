# 手机 LAN 入口与设备配对验证

日期：2026-10-10。来源：[SPEC-017 #99](https://github.com/CaiZongyuan/llm-music/issues/99)、[M1 #100](https://github.com/CaiZongyuan/llm-music/issues/100)。基线 `6321377`，候选分支 `issue-100-mobile-lan`。本记录覆盖后端入口与公开接口；不代替手机产品、FLAC 原生播放、APK、Android 真机或 GPU 验收。

## 实现与影响

`music-api serve --lan-host 实际IPv4 --lan-port 8001` 与 `pnpm dev -- --api-lan-host 实际IPv4 --api-lan-port 8001` 显式开启额外入口。启动前确认地址属于活动本机接口，绑定精确 loopback/LAN socket 后建立 ASGI server 地址表。未知绑定拒绝；Host、Forwarded、X-Forwarded-Host 与客户端地址不授予本地权限。一个 Uvicorn Server 启动一个 API lifespan、Database、JobService、Runtime adapter 和 Job event broker。ComfyUI 与 Web 仍监听原有本机地址。

迁移 `0009_device_pairing` 保存稳定 `server_id`、设备 token 摘要和配对窗口。设备 token 为 32 随机字节的 64 位小写 hex；PIN 为六位、120 秒、五次错误。设备与窗口的消费在同一 SQLite 写事务提交。当前窗口按持久化自增序号选择，不依赖系统时钟或随机 UUID 排序。服务端不保存明文 token 或 PIN。精确 claim 重放恢复原设备；已撤销设备不能恢复授权。

本地 owner 写操作要求当前进程 `X-Owner-CSRF`；浏览器存在 Origin 时必须属于明确本地 API/Web allowlist。本机无 Origin 的 CLI 仍需要 CSRF。LAN 设备不能执行 owner 管理。匿名 LAN 仅允许 `GET /connection` 与 `POST /pairing/claim`；其他 HTTP、WebSocket、Asset GET/HEAD/Range 在对象读取前授权。撤销关闭活动 WS（4401），拒绝之后的 HTTP/HEAD/Range，不取消已运行 Job。已返回字节不作收回承诺。LAN HTTP 不写完整访问 URL，WS 握手日志剥离 query，误放在 URL 的凭据不能授权或进入监听日志。

受影响消费者及证据：

| 边界 | 真实消费者 | 实际检查 |
| --- | --- | --- |
| API lifespan / socket 权限 | CLI、launcher、旧 CPU ASGI/HTTP fixtures | 真正 Windows 双监听：同 PID、一次 startup/shutdown；原任务 running 时后续任务仍 queued，释放后两个任务完成；真实未登记第三 socket 拒绝 |
| HTTP/WS/文件授权 | 配对手机、旧 loopback Web/client | LAN 伪造本地 Host/Forwarded 仍 401/403；匿名业务读写、health、diagnostics、OpenAPI、docs 拒绝；授权 HTTP/WS 成功，撤销 WS 4401 与后续 401 |
| 持久 schema / claim | API 重启、并发手机、设备管理 | 跨真实进程重启保留身份、错误次数与精确 claim；并发两个设备只有一个 201；相同意图并发重放 200，不重复授权；旧进程 CSRF 失效 |
| 原始 Asset 读取 | Web 音频、原生 HTTP/audio adapter | 原始 WAV 字节/MIME/ETag，HEAD 200 空 body，Range 206 精确 slice/416；撤销后 HEAD/Range 401；本地仍能读取 |
| owner 进程与 listener 归属 | dev.py readiness/reuse/cleanup | 双 socket 归属与签名，动态 API/Web Origin 管理；LAN 配置改变与未知 LAN 占用拒绝，原 owner 继续运行；复用会话不停止原服务，原 owner 正常释放两个 socket |
| 生成契约 | Pydantic/OpenAPI、TypeScript client、文档参考 | CPU 导出和 HTTP discovery 一致，Bearer/OwnerCSRF、条件 local/LAN 权限、claim 409/410/429、GET 206 binary/416 plaintext、HEAD 契约已登记；生成 client 的 416 字符串错误保留准确类型 |

直接 ASGI 测试没有物理 listener 时，仅未配置 LAN 的旧 fixture 保留本地兼容路径。真实 CLI 和 launcher 总是传入实际绑定表；配置 LAN 时不存在缺表跳过鉴权。所有新接口以 Pydantic/OpenAPI 为事实来源。

## 执行与结果

全部使用独立 API uv 环境、锁定依赖、Windows、临时数据库/文件、随机空闲端口、Fake Runtime；LAN socket 证据明确选择 WLAN `192.168.31.209`。未使用生产数据库、GPU、共享 Metro 或 Android 模拟器。命令从该候选 worktree 根目录执行：

```powershell
$env:MUSIC_TEST_LAN_HOST = '192.168.31.209'
uv run --project services/api --no-sync pytest services/api/tests -q
uv run --project services/api --no-sync pytest services/api/tests/test_mobile_pairing.py services/api/tests/test_mobile_lan_socket.py services/api/tests/test_client_contract.py -q
uv run --project services/api --no-sync pytest tests/launcher -q
uv run --project services/api --no-sync mypy --config-file services/api/pyproject.toml services/api/src/music_api
pnpm client:check
pnpm test:client
pnpm docs:check
```

- API 全套：245 通过，656.84 秒。随后最后的 WS 日志、终态关闭和 OpenAPI 改动由 17 项 focused 检查验证，23.76 秒；没有重跑无关全套。
- launcher 全套：15 通过，118.83 秒，覆盖默认本地、原生 CPU peer 复用及新增 LAN 行为。
- mypy：按项目严格配置纳入的 61 个 source 文件通过；配置排除 vendor ABC 实现，早期未加载配置的检查计 62 个文件。干净基线原有三处类型错误经 Root 独立复现；此候选只在现有已校验时长输入增加静态 cast，并把 Runtime 的 Mapping 复制为 factory 的 dict，保留 `int()` 行为。
- Root 在同候选生成 client、添加已知 JSON 错误的 envelope 类型缩窄后，`client:check` 通过；六项真实 Node HTTP/FormData/WS/重启/ownership 检查通过，39.2 秒。
- 文档：15 项生成来源/章节/语言/示例检查通过；Astro 19 文件零错误、零警告。构建 66 页，检查 5,189 个引用。真实 Chromium 已核对中文 LAN 章节、完整参数化代码例子与本页导航，并通过语言选择切换到英文同一章；截图保留在 `.scratch/m1/docs-lan-zh.png`。

有效 red→green 证据包含 connection 404→200、Asset HEAD 405→200、launcher 不支持 LAN 参数→真实两监听、同钟逆 UUID 取到旧窗口→最新窗口、重复 token 新 device 503→409、非 ASCII CSRF TypeError→403，以及 WS query 凭据被协议日志记录→拒绝且日志无凭据。相关回归观察公开 HTTP/socket/log 行为，故障只注入隔离的系统边界。

JUnit 与输出保留在候选 worktree `.scratch/m1/{api-suite,focused-final,launcher-suite}.{xml,log}`；文档输出在 `.scratch/m1/docs-check.log`。245 项 API 全套保留既有 Starlette 测试客户端弃用与 Alembic 反射约束警告；未把无关 warning 修整混入此票。

完成前的局部复杂度检查覆盖新增 access、pairing、serving、0009、入口/launcher 和真实消费者。保留 socket 权限、持久事务、WS 生命周期及文件读取的独立责任；没有发现需要额外抽象或删除的同票实现。源代码、生成契约、英文/中文启动指南及受控 LAN 例子同批交付。实际手机配对 UI、持久请求恢复、原始 FLAC/header/seek、真机/APK 与 GPU 闭环继续按后续实施票据验收。
