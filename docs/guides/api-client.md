# 使用生成的 TypeScript API 客户端 {#api-client}

这是供维护者和客户端开发者查阅的次级指南。音乐创作教程保留为文档主入口。当前客户端通过 FastAPI 创建 Project、上传 Reference Audio、跟踪 Job、取得 Candidate 和显式保存 Version。它不连接 ComfyUI。

## 准备独立环境 {#prepare}

从仓库根目录运行。需要 Node 24.18.0、pnpm 11.22.0、uv 0.11.28 和 Python 3.12.13。FastAPI 与 Runtime 继续使用独立环境和锁文件。

```powershell
pnpm install --frozen-lockfile
uv sync --project services/api --locked --python 3.12.13
pnpm client:check
pnpm --filter @llm-music/api-client build
```

`client:check` 在两个隔离目录执行 `music-api openapi`，比较生成结果与受版本控制的 [schema.ts](../../packages/api-client/src/schema.ts)，然后检查 TypeScript。导出不创建应用数据库、不启动 Runtime、不读取模型。生成失败时，终端给出保留的临时证据目录。修改 Pydantic 接口后运行 `pnpm client:generate`，提交并审阅生成差异。

## 得到一个可检查的结果 {#first-result}

先在一个终端启动隔离的 fake API：

```powershell
$env:MUSIC_API_RUNTIME_MODE = "fake"
uv run --project services/api --no-sync music-api serve --data-dir data/client-example-fake --port 8000
```

在另一个终端执行完整 [生成与保存示例](../../packages/api-client/examples/generate-save.ts)：

```powershell
node packages/api-client/dist/examples/generate-save.js --base-url http://127.0.0.1:8000 --expect-mode fake --output-dir data/client-example-output-01
```

示例创建一个 Project，提交一次 Generate，读取 Candidate 与 Score，下载音频和 ABC，核对 SHA256 与字节数，再显式选择该 Candidate 并保存一次 Version。终端返回真实应用 id；新输出目录保留 `receipt.json`、`song.flac` 和 `score.abc`。fake 音频是测试音，不能说明音乐质量或真实推理。输出目录已存在时，命令拒绝覆盖。

真实 Runtime 仍需先通过 [应用诊断](api-runtime-diagnostics.md) 并使用独立的真实数据目录。只有 GPU 资源 owner 执行真实推理；示例的 `--expect-mode comfyui` 会要求连接的 FastAPI 报告该模式与 readiness。此参数不会启动 Runtime或更新就绪凭据。

<<< ../../packages/api-client/examples/generate-save.ts

## 请求与结果 {#requests}

[客户端入口](../../packages/api-client/src/index.ts) 只提供 typed `createMusicClient`、`jobEventsUrl` 和生成 schema 的别名。Project、Asset、Job、Candidate、Version 与诊断类型来自 `components`；HTTP 路径和方法来自 `paths`。

| 操作 | 传输与检查 |
| --- | --- |
| 上传 | `POST /projects/{project_id}/assets`；生成的 `file` 类型是 Blob。用原生 File 与 FormData，通过该请求的 `bodySerializer` 设置 multipart body；由 fetch 生成 boundary，勿手写 Content-Type。 |
| 转谱 | 当前支持 16 秒 PCM16 mono24k 或 stereo48k。上传成功不表示任意 600 秒音频可推理。完成后读取 Job 返回的 Score、ABC 和 MIDI 应用 id。 |
| 从选定乐谱生成 | `POST /projects/{project_id}/jobs/generate-from-score` 使用生成的 `GenerateFromScoreCreate`，提交明确 ABC、同 Project 来源 Score、可选来源 parent 与生成设置。原文与有效推理文本分别保留；[完整操作与限制](generate-save-api.md#selected-score)。 |
| 下载 | 用 `parseAs: 'arrayBuffer'` 或 `'blob'`。成功的 MIME 可以是 WAV、FLAC、ABC 或 MIDI；与 Asset 元数据核对字节数和 SHA256。失败响应仍为 typed JSON `error`。 |
| 取消与重试 | 两个 POST 都没有 body。取消可返回 202 意图或 200 终态；继续查询原 Job。显式 retry 返回 202 和新 Job，客户端不会自动重试。 |
| 保存 | Candidate 不自动成为 Version。第一次显式保存返回 201；相同 Candidate 的重复保存返回 200 和原 Version id。 |
| 错误 | 读取 `response.status` 和 `error.error.code/message/recovery`。错误码是开放的 string；网络断开会抛出传输错误，不伪造成业务 503。 |

当前 `seed` 的服务端范围是 0 到 2^63−1 的 JSON 整数。JavaScript Number 只能精确表达 0 到 `Number.MAX_SAFE_INTEGER`（2^53−1）。客户端必须选择非负 safe integer；示例用 `2026192201`。此版本没有字符串 seed 合同，也不承诺超出安全范围的 JSON 数字保持精确。

## 事件丢失与失败恢复 {#recovery}

`jobEventsUrl(baseUrl, projectId, jobId)` 从实际注册的 WebSocket 路由生成 URL，并保留应用部署前缀。FastAPI 的 OpenAPI `x-websockets` 描述该通道及同源 `JobEventRead` payload。生成 TypeScript 类型不等于校验任意 WebSocket JSON；面对不可信服务时仍需在客户端边界做运行时校验。

连接后先取得持久 Job 快照，后续消息是 `job.updated`。`sequence` 只表示本进程事件顺序，不能当持久 replay cursor。连接丢失时先 `GET /projects/{project_id}/jobs/{job_id}`，再重连；终态连接发送同一持久结果后关闭。不存在或其他 Project 的 Job 在 upgrade 阶段拒绝，当前 HTTP 状态是 403。

示例失败时保留 receipt 中的 Project/Job id，并读取原 Job。输入无效时修正输入；Runtime 不可用时先恢复 readiness；等待或连接失败时核对原任务。POST 不会自动重发，避免重复生成。已完成数据可在 API 重启后继续读取；正在执行任务的恢复见 [Job 恢复指南](job-recovery.md)。

## 无 GPU 验证 {#cpu-checks}

```powershell
pnpm test:client
```

该命令编译真实 Node consumer，并向生产 FastAPI 的隔离端口发送原生 fetch、FormData 和 WebSocket 请求。继承的 Fake Runtime 只控制完成、失败和取消时机；不替换业务 HTTP 路由。验证两条闭环、队列/当前任务、文件哈希、显式保存 201/200、取消/重试、404/409/422/503、断开恢复及已完成数据重新打开。测试使用自己的 API 进程和数据；不会连接保留的 Runtime 8188。

默认证据位于 `packages/api-client/.artifacts/`。`MUSIC_CLIENT_ARTIFACTS` 可指定隔离目录。每次执行保留端口、实际 API leaf PID、创建时间、进程日志和停止回执；API 正常停止后，已完成数据仍保留。这个 CPU 结果不能替代真实 GPU smoke；P1 的实际证据与限制记录于 [阶段验收维护报告](../verification/p1-gate.md)。
