# 订阅 Job 事件并通过 HTTP 恢复

应用 WebSocket 提供 Job 实时快照。HTTP 查询是持久状态来源，事件丢失后继续查询同一应用 Job id。当前是 P1 API 流程；正式 Web Monitor 由 P2 交付。

## 观察 Morning song

在仓库根目录启动独立 API。使用单独的 fake 数据目录；它产生明确标识的 CPU 夹具，不代表真实推理速度或音乐效果。

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "fake"
uv run --project services/api --no-sync music-api serve --data-dir data/application-events-fake --port 8000
```

按 [转谱指南](api-transcription.md) 或 [生成指南](generate-save-api.md) 创建 Morning song 的应用 Job，保留 Project id 与 Job id。在另一个终端填入这些值，使用新的输出文件：

```powershell
uv run --project services/api --no-sync python services/api/examples/watch_job.py --project-id <PROJECT_ID> --job-id <JOB_ID> --output data/job-events/first.json
```

示例打印实际收到的 status、phase 与 progress，并保存原领域事件和最终 HTTP Job。若 Job 已完成，首次快照直接显示持久终态。示例只读取同一任务，不创建、重试或取消 Job，也不修改其 Assets。

完整源码：

<<< ../../services/api/examples/watch_job.py

## 使用事件合同

连接 `WS /projects/{project_id}/jobs/{job_id}/events`。每条 JSON 包含 `type="job.updated"`、当前直播序号 `sequence` 和 `job`。`job` 与 `GET /projects/{project_id}/jobs/{job_id}` 共用 Pydantic JobRead：应用 id、五态、领域 phase、progress、结果与恢复错误。Runtime prompt/node id 与原始 caption 不进入消息。错误 Project 或 Job 引用拒绝 WebSocket，close code 为 4404。

连接先登记订阅，再读取新鲜持久快照；已缓冲的旧事件不能把较新快照变回 queued。序号是当前直播通道的顺序，不是永久事件游标。重连先接收新的持久快照，重置旧直播序号；HTTP 可补回遗漏的终态。慢客户端可能省略中间快照，终态不会依赖事件回放。

只有有来源的阶段才显示。锁定插件 caption 可确认 loading_model、transcribing、planning_score、generating_semantic、synthesizing 或 decoding_audio；无法确认时为 null。阶段没有固定百分比，也不要求单调排列。ComfyUI 的节点进度条包含估算份额及 token 上限，当前转谱/生成不把它们转换为 Job 比例。只有可靠、有限、0–1 的整个任务读数才可返回 progress，否则为 null。

应用确认原生完成后先持久记录 `running/saving`，再校验、导入和关联整个结果集。完成这些步骤后才产生 completed。取消、失败和完成的终态保持稳定；重复、乱序或迟到的原生提示不能直接完成 Job 或重复导入。原生 WS 丢失时仍查询目标的 HTTP queue/history。

## 复现断线恢复

对同一 Job 运行一次新的输出文件，刻意在首个快照后断开：

```powershell
uv run --project services/api --no-sync python services/api/examples/watch_job.py --project-id <PROJECT_ID> --job-id <JOB_ID> --disconnect-after-first --output data/job-events/disconnected.json
```

查看文件中的 `websocket_outcome` 与 `http_job`。如果任务尚未结束，继续 GET 同一 Job id；超时只表示观察窗口结束，不能据此再次提交。failed 的 error/recovery 指导恢复；未完成的输出不会成为成功结果。完成后从 result 中的应用 Asset id 下载原文件。

每个 WebSocket 只观察一个 Project 的一个 Job，终态快照发送后正常关闭。客户端断线不取消推理。API 重启后的活动任务对账由独立恢复票据交付；这里不承诺活动任务重启后自动恢复执行。真实 Runtime 仅由 GPU owner 使用 [新鲜来源收据](../reference/runtime-evidence.md) 和独立数据目录验证。维护证据见 [Job 事件验证记录](../verification/api-job-events.md)。
