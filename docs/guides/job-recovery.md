# 在 API 重启后找回原 Job {#job-recovery}

使用原 Project 和 Job id，找回已排队、运行或完成的工作。当前是 P1 HTTP/Swagger 流程。API 重启只核验原 Runtime 工作，不再次提交推理，也不重新上传 Reference Audio。

## 前提与启动 {#start}

先按 [生成与保存](generate-save-api.md) 或 [转谱](api-transcription.md) 提交 Job。保存响应中的 Project 和 Job id。由服务 owner 停止并重启 API，保持原数据目录、Runtime 模式和原 Runtime 地址。重启前备份整个应用数据目录；SQLite、Asset 文件和私有任务记录须一起保留。

在仓库根目录执行。已有服务须先停止；端口按实际服务配置替换。

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "comfyui"
$env:MUSIC_API_RUNTIME_URL = "http://127.0.0.1:8188"
$env:MUSIC_API_RUNTIME_EVIDENCE_PATH = "data/runtime/current-receipt.json"
uv run --project services/api --no-sync music-api serve --data-dir data/application-comfyui --port 8000
```

替换示例收据和目录为原服务的路径。当前收据用于新任务的 readiness；已接受任务的恢复使用它原先持久保存的 Workflow、输入、Runtime 地址与原图证据。收据过期不会撤销已有产物。fake 与 comfyui 使用各自的数据目录；普通 fake 夹具的内存任务在进程退出时消失，尚未导入的工作会进入有界失败。已经完成的应用结果仍可读取。

## 查询同一个 Job {#read-job}

在另一个终端，从仓库根目录执行。将两个占位 id 替换为已保存的值：

```powershell
uv run --project services/api --no-sync python services/api/examples/job_recovery.py wait --project-id <PROJECT_ID> --job-id <JOB_ID> --wait-seconds 330
```

示例只通过 `GET /projects/{project_id}/jobs/{job_id}` 查询。API 暂时断联时继续等待；示例等待超时后退出，原任务仍保留。可用 `inspect` 立即读取一次。不要通过重新提交 Generate 或 Transcribe 来找回结果。

| 公开状态 | 行为 |
| --- | --- |
| queued / running | 已确认的原工作继续被观察。`progress` 只显示真实测量值，未知时为 null。 |
| queued / running 且 recovery_required=true | 原 ownership 或状态暂时无法确认。读取 `error` 的原因与恢复建议，保留原 Job。 |
| completed | 整个结果集已校验并导入应用。重复查询和重启不会新增同一结果。 |
| failed / cancelled | 原终态保留。恢复不会将它改为 completed。 |

成功时加入 `--output-dir data/recovered-job-01`，下载现有 Audio、ABC 或 MIDI。目录须不存在；这是应用 Asset 下载，不读取 Runtime 文件路径。Generate 的 Candidate 仍需按 [生成与保存](generate-save-api.md) 显式保存为 Version。已有 Version、快照和 Asset 不会被本次恢复覆盖。

## 无法确认时 {#uncertainty}

原图、attempt、client、handle 或输出绑定不一致，重复映射、缺失历史及 Runtime 不可达都会阻止错误认领。只有不透明 handle、没有完整原证据的旧 Job 不会被补造图或自动运行。升级会保留已有数据和终态；旧活动 Job 可能以 `failed/runtime_unavailable` 结束。

默认确认窗口是 300 秒，最多 30 次确认读取，间隔从 1 秒增加到 10 秒。它们分别来自 `MUSIC_API_RECOVERY_CONFIRMATION_WINDOW_SECONDS`、`MUSIC_API_RECOVERY_MAX_ATTEMPTS`、`MUSIC_API_RECOVERY_POLL_INTERVAL_SECONDS` 与 `MUSIC_API_RECOVERY_MAX_POLL_INTERVAL_SECONDS`。浮点秒数须正且有限，次数须正整数。所有读取仍受 `MUSIC_API_RUNTIME_TIMEOUT_SECONDS` 约束。

首次不确定时保存的窗口与次数不会因查询、事件、轮询或再次重启而重置。超出预算后为 `failed/runtime_unavailable`，保留原输入、provenance、映射与原因。已确认运行的 Job 可继续运行超过确认窗口；下次重启先进行一次有界原证据核验，核验失败后仍遵守原预算。确认窗口不是生成时长限制。

恢复 Runtime 连接或应用文件后，先查询原 Job。需要明确重试时执行：

```powershell
uv run --project services/api --no-sync python services/api/examples/job_recovery.py retry --project-id <PROJECT_ID> --job-id <JOB_ID>
```

这对应一次 `POST .../retry`。成功返回 `202` 与新的 Job id；新任务使用当前 readiness 与 Workflow，并记录 `retry_of_job_id`，原 Job 不变。`409 retry_unconfirmed` 表示原 native 工作没有可确认的安全终态；保留证据并让 Runtime owner 核验，不能重复点击提交。`409 job_not_retryable` 表示原 Job 仍活动或已完成。重试响应丢失时，查询 Project 的 Job 列表，不能自动重复 POST。

完整示例来自受版本控制的源码：

<<< ../../services/api/examples/job_recovery.py

验证范围见 [维护记录](../verification/job-recovery.md)。真实 G35 中断恢复与新的 T16 转谱由 GPU owner 单独验证；CPU 夹具不能证明模型推理效果。
