# 创建 Project 并持久上传参考音频

本地应用 API 现在支持创建、列出和读取 Project，以及上传、列出、读取和下载其 Reference Audio。文件由应用长期保存，API 重启后使用相同 id 读取。此 P1 起始路径使用独立 CPU 环境。

## 得到第一个结果

在仓库根目录操作。安装 Python 3.12.13 和独立应用依赖，再启动 API：

```powershell
uv sync --project services/api --locked --python 3.12.13
uv run --project services/api --no-sync music-api serve --data-dir data/application --port 8000
```

默认只绑定 `127.0.0.1`。打开 `http://127.0.0.1:8000/docs` 查看 Swagger；`/openapi.json` 是当前合同。在第二个终端运行完整示例：

```powershell
uv run --project services/api --no-sync python services/api/examples/project_upload.py --output-dir data/project-upload-example
```

示例目录须不存在。示例生成原创 CC0 的 16 秒、24 kHz mono PCM WAV，创建 **Morning song** Project，上传文件，再下载并逐字节核对。输出 `reference.wav`、`downloaded.wav` 和 `receipt.json`；每次收到创建/上传响应后立即保存其 id。它向正在运行的 API 写入真实 Project/Asset。完整源码为 [project_upload.py](../../services/api/examples/project_upload.py)。

使用 receipt 中的 id 查询元数据：

```powershell
$receipt = Get-Content -Raw data/project-upload-example/receipt.json | ConvertFrom-Json
Invoke-RestMethod "http://127.0.0.1:8000/projects/$($receipt.project.id)"
Invoke-RestMethod "http://127.0.0.1:8000/projects/$($receipt.project.id)/assets/$($receipt.asset.id)"
```

停止 API，再用相同启动命令和 `--data-dir` 重开。这两个查询及 `/projects/{project_id}/assets/{asset_id}/content` 应继续返回原对象和原始音频。不再运行完整示例来验证重启，否则会创建另一份 Project/Asset。

## 当前 HTTP 合同

| 操作 | 路由 | 返回 |
| --- | --- | --- |
| 创建 Project | `POST /projects`，JSON `name`、可选 `description` | `201`，应用 UUID、名称、描述、UTC 创建时间。 |
| 列出/读取 Project | `GET /projects`；`GET /projects/{project_id}` | `200`。 |
| 上传 Reference Audio | `POST /projects/{project_id}/assets`，multipart 字段 `file` | `201`，Asset UUID 与实际音频事实。 |
| 列出/读取 Asset | `GET /projects/{project_id}/assets`；其 `/{asset_id}` | `200`，同 Project 的元数据。 |
| 下载原文件 | `GET /projects/{project_id}/assets/{asset_id}/content` | `200 audio/wav`，原始上传字节。 |

Project 名称去掉首尾空白，长度 1–200 字符；描述至多 2000 字符。Asset 返回 `kind=reference_audio`、实际 `format=wav`/`media_type=audio/wav`、原名的文件名部分、size/SHA256、duration/channel/rate/sample-width 和创建时间。filename/MIME 不决定实际格式，也不决定保存路径。应用不公开文件系统定位；id 属于应用。

当前支持非空、完整的 mono/stereo PCM WAV：8、16、24 或 32 bit 整数样本，8–192 kHz。工具逐个读取所有 PCM 帧，拒绝截断或不支持的内容。默认文件预算 64 MiB、时长预算 600 秒；这些是应用上传政策，不表示模型已经验证相同长度。完整 multipart 请求另有 64 KiB 的字段/边界余量，含无 Content-Length 的请求。可在启动前设置 `MUSIC_API_MAX_UPLOAD_BYTES`、`MUSIC_API_MAX_AUDIO_SECONDS`；必须为有限正值。

应用创建 `--data-dir/app.sqlite` 和 `--data-dir/assets/`。SQLAlchemy 2/Alembic 管理元数据，SQLite WAL 保存事务；原始文件独立保存在应用 storage。默认 data-dir 为仓库 `data/`，也可用 `MUSIC_API_DATA_DIR`；CLI 参数优先。保持同一配置并将数据库与 Asset 文件一起备份。Runtime 临时源文件清理不影响已成功导入的文件。当前 schema 只包含 Project 与 Reference Audio；Job、Score、Candidate、Version 和正式 Web 由后续已规划票据交付。

## 失败与恢复

错误返回 `{ "error": { "code", "message", "recovery", "resource_id" } }`。开发路径和异常细节进入服务日志。

| 情况 | 响应与行动 |
| --- | --- |
| 参数不合法/音频损坏 | `422 invalid_request` 或 `invalid_audio`；修正参数或导出支持的完整 PCM WAV。 |
| 超出预算 | `413 upload_too_large` 或 `audio_duration_exceeded`；使用更小/更短的音频，或由 owner 明确调整政策。 |
| Project/Asset 不存在或跨 Project | `404 project_not_found` / `asset_not_found`；选择目标 Project 的 Asset。 |
| 既有文件缺失/不完整、路径映射越界 | `409 asset_unavailable` / `asset_path_invalid`；从备份恢复原文件/元数据。列出素材时也会明确报告不可读取状态。 |
| 写文件或明确未提交的元数据失败 | `503 asset_write_failed` / `asset_persistence_failed`；检查应用 storage/数据库，修复后显式重试。 |
| 提交回执或结果无法确认 | `503 asset_commit_unconfirmed`；保留文件，先用 `resource_id` 查询同 Project 的 Asset 和 content，避免重复上传。 |
| 本次文件补偿失败 | `503 storage_cleanup_failed`；先查询 id，保留日志并由 owner 处理本次隔离文件。 |

文件和数据库不是一个原子事务。每次上传使用私有 staging、完整验证、独占创建新文件、fsync 和元数据 commit。明确 rollback 且新连接确认没有持久行时才删除本次 final；已提交或不确定时保留文件。不会覆盖旧 Asset，也不会执行全局删除/GC。进程在 commit 前崩溃可能留下未注册文件；保留并根据日志核对，不能靠删除整个 storage 恢复。

初次启动从空数据库迁移到 `0001_project_audio`；建表也使用显式 SQLite 事务，失败后可修复底层问题再启动。重复启动保留现有对象。遇到不支持的 schema revision 时启动/迁移失败并保留数据；恢复兼容版本或完整备份，不手工 stamp 跳过迁移。

## 独立验证和合同导出

```powershell
uv run --project services/api --no-sync python -m pytest services/api/tests -q
uv run --project services/api --no-sync mypy --config-file services/api/pyproject.toml services/api/src/music_api
uv run --project services/api --no-sync music-api openapi --output data/api-openapi.json
```

OpenAPI 从 Pydantic 导出，不启动 storage、数据库、模型或 Runtime。`music-api migrate --data-dir data/application` 可单独升级当前支持的 schema。现有 tests 使用独立临时 SQLite/storage 和真正的 API 子进程，覆盖持久读回和失败补偿；维护证据见 [验证记录](../verification/api-project-audio.md)。
