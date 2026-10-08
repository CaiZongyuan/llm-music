# 通过应用 API 生成并保存歌曲

通过 style、lyrics 和 seed 生成可试听 Audio 与可检查 Score，或把明确选定的 ABC 交给 GenerateFromScore。生成成功得到 Candidate；明确保存后才得到 Version。这是按需使用的 API 指南；正式 Web 的乐谱仍为只读。默认 fake 模式使用原始 CPU 夹具，不能证明模型效果。

## 启动独立 API

在仓库根目录执行。FastAPI 使用自己的 uv 环境和锁文件，不需要 Torch、CUDA 或运行中的 ComfyUI。

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "fake"
uv run --project services/api --no-sync music-api serve --data-dir data/application-fake --port 8000
```

打开 `http://127.0.0.1:8000/docs`。应用在指定目录保存 SQLite 与 Asset 文件；重新启动时使用同一目录。fake 与 comfyui 数据目录分别使用，既有目录的模式不能切换。

## 生成并检查 Candidate

在另一个终端，从仓库根目录创建 UTF-8 歌词文件，例如 `data/morning-lyrics.txt`：

```text
[Verse]
Morning gathers on the window
Let the quiet carry us home
```

运行完整示例。该命令创建 Project 并提交 Generate；已有 Project 可传 `--project-id <PROJECT_ID>`。使用新的输出目录。

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py generate --style "gentle folk pop" --lyrics-file data/morning-lyrics.txt --seed 2026192201 --output-dir data/morning-candidate-01
```

终端输出 `project_id` 和 Candidate，下载目录包含 `audio.flac`、`score.abc`。试听音频、阅读乐谱，再决定是否保存。fake 音频是明确标识的测试音调。命令不会创建 Version。

HTTP 请求为 `POST /projects/{project_id}/jobs/generate`。style 与 lyrics 去掉首尾空白后必须非空，分别最多 1024 和 10000 个字符。seed 必须是 0 到 `2^63−1` 的整数。`max_seconds` 仅支持 35；当前只验证短歌配置。

请求返回 `202` 与应用 Job id。查询 `GET /projects/{project_id}/jobs/{job_id}`；五种状态为 queued、running、completed、failed、cancelled。成功结果包含 `candidate_id`、`audio_asset_id`、`abc_asset_id` 和 `score_id`。应用完成 Score 校验、FLAC 全解码和整个输出集导入后，才标记 completed。

Candidate 可从 `GET /projects/{project_id}/candidates` 列表，或 `/candidates/{candidate_id}` 读取。它保留输入、运行参数、Workflow/Runtime provenance 和输出事实。G35 输出当前要求 FLAC PCM16、48 kHz、双声道、30–40 秒，并且全解码帧数与 STREAMINFO 声明一致。声明样本数为零的合法流式 FLAC 暂不能在这个已验证配置中完成确认。

## 从选定乐谱生成 {#selected-score}

创作者可以直接按[编辑与重新生成教程](../learn/edit-score.md#regenerate)在正式 Web 完成相同操作。乐谱页明确选定已保存的有效 Score，任务与结果显示实际提交 ABC 和来源 parent。下面的 API 与 CLI 补充用于脚本创作。

保持同一个 Morning song Project。先下载一个生成或转谱 Score 的 ABC，复制到新文件，再修改一处音符。保留原生 `Vocal` / `Ins` 双声部头、完整小节和节拍；一般 ABC 能在浏览器显示，并不代表锁定的推理插件支持它。可以对照[最小原生 ABC](../../workflows/generate-from-score/v1/example.abc)。当前只接受该插件的双声部方言，且至少一个声部有音符；Vocal 全休止、Ins 有旋律的转谱结果也可用。

例如把下载谱中的 `D4` 改为 `F4`，另存为 `data/morning-selected.abc`。先阅读并试听乐谱，再选择要提交的这一份。以下命令复用上一步的 Project 和来源 Score，创建新 Audio Candidate：

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py from-score --project-id <PROJECT_ID> --source-score-id <SOURCE_SCORE_ID> --abc-file data/morning-selected.abc --parent-version-id <SOURCE_VERSION_ID> --style "gentle folk pop" --lyrics-file data/morning-lyrics.txt --seed 2026410001 --output-dir data/morning-score-candidate-01
```

`SOURCE_SCORE_ID` 来自原 Candidate 的 `score_id` 或转谱 Job 的结果。若从已保存 Version 开始，`SOURCE_VERSION_ID` 必须是拥有该 Score 的同 Project Version；仅从转谱 Score 开始时省略 `--parent-version-id`。命令不会改写原 Score、素材或 Version，也不会自动保存新 Version。下载新 `audio.flac` 后，判断改动后的旋律与风格是否值得保留。

这对应 `POST /projects/{project_id}/jobs/generate-from-score`，请求包含 `abc`、`source_score_id`、可选 `parent_version_id`，以及 Generate 的 style、lyrics、seed 和 `max_seconds=35`。ABC 最多 100000 个字符；源 Score 与 parent 必须属于同一个 Project。非法或不支持的 ABC 在创建 Job 前拒绝。没有该 capability 时明确拒绝，不能改用普通 Generate。

正式 [ABC 编辑器](../learn/edit-score.md) 已能独立保存修改。`POST /projects/{project_id}/scores/validate` 用当前锁定解析器检查 `abc`，没有 Job 或 GPU 调用。`POST /projects/{project_id}/scores` 保存原文到新的 ABC Asset 与 Score，接受可选 `source_score_id`、`parent_version_id` 和稳定 `save_id`。首次返回 `201`；以同一保存 id、Project、来源、parent 与原文哈希重放返回 `200` 与同一 Score，不同意图返回 `409 score_save_conflict`。`job_id=null` 明确表示独立保存，没有自动 Candidate 或 Version。

从编辑后的 Score 继续时，`source_score_id` 使用新保存 Score 的真实 id；parent 可为拥有原来源的 Version，或该 Score 已记录的编辑 parent。连续编辑继承这一 parent；不会冒用旧 Score id 或改写旧素材。保存确认不明时，`score_commit_unconfirmed` 的 `resource_id` 指向可读回的 Score；客户端保留同一 `save_id` 和输入进行显式恢复。

Job 与 Candidate 的 `inputs.abc` 保存请求原文。`provenance.selected_score` 保存原文哈希、`effective_abc`、有效输入哈希、转换列表与适配版本。锁定插件会因内部 `%yue2-words` 标记不匹配而重新规划，也会重排没有 section 注释的裸谱。版本 1 适配移除匹配的内部标记；裸谱增加一个中性 section 注释，保留音符、小节、节拍、速度、声部和和弦。现有带 section 的生成谱与转谱谱无需这项转换。该记录区分原文和实际推理文本；它不承诺注释处理前后产生相同音频。

排队或运行后继续编辑本地文件，不会改变已提交 Job。需要另一个编辑结果时，重新选择有效 ABC 并明确提交新 Job。输出 Score 必须与实际提交的有效文本一致；音频仍经过完整 FLAC 校验。失败结果不会成为 Candidate 或 Version。

## 明确保存 Version

GenerateFromScore 的 Candidate 保留提交时的来源 parent。保存时省略 parent 字段，应用仍使用该 parent；显式给出不同 parent 返回 `409 source_parent_mismatch`。在新 Version 中检查输入 ABC 和 parent，再次读取原 Version，确认两个创作结果分别保留。

将占位值替换为上一步输出，运行：

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py save --project-id <PROJECT_ID> --candidate-id <CANDIDATE_ID> --name "First morning"
```

这对应 `POST /projects/{project_id}/versions`。可加 `--parent-version-id <VERSION_ID>`，从同 Project 的已有 Version 建立分支。保存复制 Candidate 的输入、provenance 与输出快照；后续生成不会覆盖既有快照或 Asset。名称去掉首尾空白后必须非空，最多 200 个字符。

第一次保存返回 `201`。相同 Candidate、名称和 parent 重复保存返回 `200` 与同一 Version，包括并发请求。更改已保存 Candidate 的名称或 parent 返回 `409 version_already_saved`，错误中保留既有 Version id。为新的保存意图生成新的 Candidate。

用 `GET /projects/{project_id}/versions` 查看列表，用 `/versions/{version_id}` 再次读取。通过应用 Asset `/content` 地址下载音频或 ABC。停止并重启 API 后，使用同一数据目录读取历史；应用文件无需保留临时推理输出。

## 失败恢复与真实 Runtime

- `422 invalid_request`：修正空输入、seed 或超出范围的字段，再提交。
- `422 score_invalid`：保留编辑文件，修正原生头、音符或不完整小节，再重新选定。通用 ABC 的显示成功不能替代原生推理校验。
- `503 capability_missing`、`404 score_not_found` / `parent_version_not_found`、`409 source_parent_mismatch`：检查当前 capability，选择同 Project 且关系正确的来源。`score_result_mismatch` 表示 Runtime 输出替换了选定 Score；保留失败 Job 与快照，核对映射后再明确重试。
- failed Job：读取其中的错误与 recovery_required，保留该 Job。缺输出、无效 Score、未完成的 FLAC 或无法确认的输出不会创建 Candidate/Version。先按[重启恢复指南](job-recovery.md)核对原工作；需要新 attempt 时，按[取消与明确重试](api-cancel-retry.md)确认安全终态并显式重试。不会自动重复推理。
- `404 candidate_not_found` / `parent_version_not_found`：选择目标 Project 的 Candidate 或已保存 parent。跨 Project 引用不能保存。
- `503 version_commit_unconfirmed`：先用错误中的 `resource_id` 查询 Version。重复保存已知 Version 时，即使确认回执和独立读回都失败，该 id 仍指向既有 Version。确认存在时读取其结果；不存在时恢复数据库访问，再重试相同 Candidate、名称和 parent。无法确认时应用保留原有 Asset 与快照。
- `409 asset_unavailable` / `asset_path_invalid`：恢复原应用文件或备份中的映射；不能用 Runtime 路径替代应用 id。

真实生成由 GPU 资源 owner 在已通过 P0 的固定 Runtime 上验证。切换 `MUSIC_API_RUNTIME_MODE=comfyui`、设置 `MUSIC_API_RUNTIME_EVIDENCE_PATH` 指向最新 owner 收据，并使用单独的应用目录。按 [Runtime 诊断证据来源](../reference/runtime-evidence.md) 收集或刷新收据；历史 Doctor 报告不能代替当前收据。复用 [Runtime 准备](runtime-doctor.md) 与已验证的 [短歌 Workflow](api-generation.md)。该指南的 CPU 夹具检查不能替代真实 Runtime 验收。

完整 HTTP 示例来自受版本控制的源码：

<<< ../../services/api/examples/generate_save.py

继续尝试[风格、歌词与 seed 玩法](../learn/variations.md)，或按需查阅[API 合同参考](../reference/api.md)与[应用配置参考](../reference/settings.md)。实际验证与限制见[维护记录](../verification/generate-save-api.md)；文档站与仓库正文使用同一来源。
