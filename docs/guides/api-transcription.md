# 通过应用 Job 获取 ABC 与 MIDI

在 Project 上传 Reference Audio 后，应用可创建 Transcribe Job。只有完整 ABC/MIDI 验证、应用文件导入及持久关联完成后，Job 才为 completed。Score 保留源 Asset 与 Job 引用；下载使用应用 id，文件不依赖 Runtime 临时输出。

## 先完成一个 CPU 示例

在仓库根目录安装独立 API 环境并启动明确的 fake 模式：

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "fake"
uv run --project services/api --no-sync music-api serve --data-dir data/application-fake --port 8000
```

按 [创建项目与上传指南](api-project-audio.md) 运行完整原创音频示例，保留其 receipt。该示例的 T16 PCM16 mono24k 已经通过额外真实输入格式验证。新请求仍须经过完整应用路径验证；fake 结果只证明应用行为。

```powershell
$receipt = Get-Content -Raw data/project-upload-example/receipt.json | ConvertFrom-Json
$base = "http://127.0.0.1:8000/projects/$($receipt.project.id)"
$body = @{ reference_asset_id = $receipt.asset.id } | ConvertTo-Json
$job = Invoke-RestMethod "$base/transcriptions" -Method Post -ContentType "application/json" -Body $body
Invoke-RestMethod "$base/jobs/$($job.id)"
```

提交返回 202 与应用 Job。重复查询该 id，直到 completed 或明确失败。completed 的 `result` 包含 `score_id`、`abc_asset_id`、`midi_asset_id`。读取 `GET /projects/{project_id}/scores/{score_id}`，再经已有 Asset content 路由下载 ABC/MIDI。列表与所有引用均检查同 Project 归属。

公开状态固定为 queued、running、completed、failed、cancelled。phase 仅按实际观察填写，progress 无可靠观测时为 null。当前支持[取消与明确重试](api-cancel-retry.md)、[Job 事件与 HTTP 恢复](api-job-events.md)，以及[API 重启后的原 Job 对账](job-recovery.md)。失败保留输入与可读 error/recovery；不能把原生 success 当作文件已导入。

## 配置真实 Runtime

只有 GPU resource owner 执行真实请求。使用独立真实 data-dir，不能把 fake 数据目录切换成真实模式；namespace mismatch 会拒绝启动并保留原数据。

```powershell
$env:MUSIC_API_RUNTIME_MODE = "comfyui"
$env:MUSIC_API_RUNTIME_URL = "http://127.0.0.1:8188"
$env:MUSIC_API_RUNTIME_EVIDENCE_PATH = "<FRESH_OWNER_RECEIPT_JSON>"
uv run --project services/api --no-sync music-api serve --data-dir data/application-real --port 8000
```

owner receipt 与 [CPU 来源核验](../reference/runtime-evidence.md) 使用同一合同。当前进程、监听、源码和模型指纹仍匹配时，原 SHA256 校验继续有效，不因超过五分钟拒绝提交；读文件不更新原 checked_at。动态 native 观测默认时间窗口为 300 秒，可用 `MUSIC_API_DIAGNOSTICS_MAX_AGE_SECONDS` 调整。当前 Runtime 失联、缺节点、GPU/版本不符、模型文件变化/缺失或 hash/binding 未核实仍拒绝提交。锁定插件的 YUE2_MODELS_ROOT 与通用 Comfy `/models` inventory 不同；合法空 inventory 不等于模型缺失。

当前实际输入范围是 16 秒 PCM16 stereo48k 或 mono24k。上传的 64 MiB/600 秒预算是存储政策，不能推断所有上传长度、位宽与采样率都支持推理。其他形状返回 `422 reference_profile_unsupported`；源字节与保存 hash 不符时拒绝。Native 转谱复用已验证的 SheetSage2 manifest，ASR/downloads 关闭，业务接口不接收 node/prompt。

## 失败恢复与重启

提交前保存 Job/attempt；原生 POST 只发一次。确认回执丢失时，Job 以明确 unconfirmed 原因失败并标记 `recovery_required`，已接受工作可能仍存在。先查看这个应用 Job 和 owner 日志；不要自动再提交或把它描述为确定未执行。API 启动会核验仍 queued/running 的原任务，不重新提交推理；无法确认原 ownership 或状态时进入有界恢复，已终态 Job 保留原终态。具体步骤和边界见[重启恢复指南](job-recovery.md)。

缺失/损坏 ABC 或 MIDI 不产生成功 Score 或完整结果。所有必需角色先验证，再独占发布并在一个 SQLite 事务关联 Assets、Score 和 completed Job。提交后报错时，新连接确认已完成就保留同 id/文件；读回不确定时也保留文件。只有确认 rollback 且不存在持久行才补偿删除本次文件。没有全局 GC。

停止并重开相同模式、相同 data-dir 的 API 后，已完成 Job、Score 和文件仍按原 id 可读。重启检查只读原 id，避免再运行创建示例。启动会执行当前版本的应用迁移，保留原上传内容；先备份完整应用数据目录，遇到不支持的 schema 时恢复兼容版本或完整备份。Pydantic/OpenAPI 是当前合同来源；[维护记录](../verification/api-transcription.md) 分别说明 CPU 与真实验证范围。

```powershell
uv run --project services/api --no-sync python -m pytest services/api/tests -q
uv run --project services/api --no-sync mypy --config-file services/api/pyproject.toml services/api/src/music_api
```
