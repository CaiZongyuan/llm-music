# 通过应用 API 取消任务与明确重试

取消一个 Project 的 Job，再决定是否创建新的重试任务。应用 id 是操作入口；输入、失败记录和已保存 Version 保留。当前使用 P1 HTTP/Swagger。fake 夹具不证明真实 GPU 取消或音乐效果。

## 准备一个任务

从仓库根目录启动独立 CPU API：

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "fake"
uv run --project services/api --no-sync music-api serve --data-dir data/application-fake --port 8000
```

按 [转谱指南](api-transcription.md) 或 [生成与保存指南](generate-save-api.md) 创建 Morning song 的 Job，记下 Project id 与 Job id。fake 任务很快完成；取消已完成任务会返回原 completed 结果。真实 Runtime 使用单独的数据目录，由 GPU 资源 owner 控制取消实验。Swagger 地址为 `http://127.0.0.1:8000/docs`。

在另一个终端检查任务。将占位值替换为应用返回的 id：

```powershell
uv run --project services/api --no-sync python services/api/examples/cancel_retry.py inspect --project-id <PROJECT_ID> --job-id <JOB_ID>
```

## 请求取消并检查结果

```powershell
uv run --project services/api --no-sync python services/api/examples/cancel_retry.py cancel --project-id <PROJECT_ID> --job-id <JOB_ID> --wait-seconds 180 --output data/diagnostics/cancel-01.json
```

这调用 `POST /projects/{project_id}/jobs/{job_id}/cancel`，不需要请求正文。`200` 表示确定终态或已终态的无操作；`202` 表示仍 queued/running。随后通过 `GET /projects/{project_id}/jobs/{job_id}` 查询。

`cancel_requested=true` 表示应用已记录取消请求，不代表已取消。只有确认结果后，status 才为 cancelled；error.code 为 cancelled，result 为空。running 的分发确认不是终态证据。queued 移除有独立确认方式。任务在取消前完成时，应用仍验证、导入并返回 completed 和完整结果；saving 期间不会假称 cancelled。重复取消终态保持原结果。

取消意图提交的回执丢失时，先查询同一 Job。queued/running 且 `cancel_requested=true` 仍需要结果确认，`recovery_required=true`。意图不证明请求已发到 Runtime；明确重复 cancel 会再次执行同一目标的归属保护与安全取消。不会改为全局中断。

取消只作用同 Project 的目标。应用尚未分发的任务可以直接取消；目标 Runtime mapping、client 和 graph 不一致时，应用拒绝破坏性操作。原 Reference Audio、其他任务、Candidate 和已保存 Version 不受取消影响。

## 明确创建新的重试 Job

只对 failed 或 cancelled 执行一次请求：

```powershell
uv run --project services/api --no-sync python services/api/examples/cancel_retry.py retry --project-id <PROJECT_ID> --job-id <JOB_ID> --wait-seconds 180 --output data/diagnostics/retry-01.json
```

这调用同一 Job 地址的 `/retry`，不需要正文。成功返回 `202` 和新的 Job id；实际 attempt 也使用新身份。新 Job 保留创作输入，再检查当前 Runtime 就绪条件并记录当前 registry provenance 与 `retry_of_job_id`。原 Job 的输入、错误和 provenance 保持不变。查询和下载使用新 Job 的应用引用。生成重试仍先形成 Candidate，明确保存后才成为 Version。

重试会创建新的工作，不具备自动去重的客户端意图键。请求失败或响应丢失时，先查询 `GET /projects/{project_id}/jobs`，按 `provenance.retry_of_job_id` 找到既有重试记录，不要循环发送 retry。示例只发送一次操作请求；等待期间只读取状态。

## 恢复失败

| 返回或错误 | 动作 |
| --- | --- |
| `404 job_not_found` / `422 invalid_request` | 修正 Project、Job id 或参数。跨 Project 的 Job 不能操作。 |
| `409 cancellation_not_dispatched` | 排队目标在移除时开始运行；读取当前状态，再明确请求取消。应用不会偷偷转为全局中断。 |
| `409 cancellation_ownership_unverified` / `cancellation_unconfirmed` | 保留原 Job 与映射，恢复归属或确认结果；不要另起可能重复的推理。 |
| `503 runtime_unavailable` | 取消确认连接失败；读取 `recovery_required` 和同一 Job。原生请求可能存在。 |
| `409 job_not_retryable` / `retry_unconfirmed` | 等待或确认原 attempt 的安全终态。completed 不重试；不确定的已接受工作不能盲目再提交。 |
| `runtime_out_of_memory` / `model_missing` / `workflow_invalid` | 恢复已验证显存配置、注册模型或 Workflow，再确认当前就绪条件。 |
| `transcription_failed` / `generation_failed` | 保留原输入和失败 Job，检查开发日志后明确创建新 attempt。 |

当前取消与重试使用持久保存的原任务映射与归属证据。API 重启后会核验仍活动的原 Job，不重新提交推理；按[重启恢复指南](job-recovery.md)读取同一 Job。缺少可核验的原 graph 或安全终态时，重试仍拒绝。已完成历史和文件可以重启读取。开发异常细节留在结构化日志，公开错误给出领域原因和动作。

旧活动记录可能缺少持久分发开始证据或完整原图，且可能已被 Runtime 接受。当前升级与恢复保留这些记录；无法确认时给出明确失败或恢复原因，不补造原图、不伪称 cancelled，也不创建未经确认的新重试。既有 failed 记录的错误、输入和 provenance 保留；恢复边界见[无法确认时](job-recovery.md#uncertainty)。

完整运行示例来自受版本控制的源码：

<<< ../../services/api/examples/cancel_retry.py

实际验证、共享模块影响与交付边界见 [维护记录](../verification/api-cancel-retry.md)。
