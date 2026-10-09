# 可检查的 Cover API

按[创作教程](../learn/cover.md)先得到一份明确选定的、已保存的转谱或编辑 Score。下面的 HTTP 路径都属于 FastAPI；客户端类型与本页生成参考共用 Pydantic/OpenAPI。API 环境无需 Torch；真实转谱和生成仍需当前已就绪的单 GPU Runtime。

## 从真实 Version 建立 Reference {#reference}

`POST /projects/{project_id}/reference-audio/from-version` 接受同 Project 的 `source_version_id` 与稳定 UUID `save_id`。首次返回201 AssetRead；同一意图重放返回200与同一个 Asset，别的来源复用该id返回409 `reference_save_conflict`。只提取真实 `Version.audio_asset_id` 的开头16秒，输出768000帧 PCM16 stereo48k WAV，不修改旧 FLAC，不创建 Job、Candidate 或 Version。没有任意 parent 或时间区间请求字段。

`GET /projects/{project_id}/assets/{asset_id}/reference-origin` 返回 source Version、source Audio Asset、原音频 SHA256、start_frame0、frame_count768000、sample_rate48000与 derivation_version1.0.0。原有上传 Reference 返回null，其 AssetRead形状不变。源音频错误、跨 Project、缺文件或 hash变化会拒绝转换。

用该 Reference id 创建已有 `/transcriptions` Job。它冻结真实来源，成功导入的 Score继承 source Version parent。上传仍只接受已有16秒 PCM16转谱配置，并没有 parent。Score独立保存沿原链继承 parent，无需放宽 GenerateFromScore的原有来源检查。

## 先检查有效输入，再提交 {#selection}

独立保存已检查的编辑到 `/scores`，取得真实新 Score id。Cover要求请求 `abc` 与此不可覆盖 Score 的实际文件逐字一致。

`POST /projects/{project_id}/cover-inputs/validate` 接受 `abc` 与 `mode="melody"` 或 `"full"`；只做CPU检查，不创建持久对象或推理任务。返回原文hash、`effective_abc`及其hash、转换、adapter/parser、mode_transform_version1.0.0、原和弦数量及 `warnings`。适配移除精确识别的内部控制标记、保护裸谱section；melody 仅从解析音乐行去和弦，full 保留已写出的和弦。两个声部与音乐事件保留。full 无和弦时返回 `full_without_written_chords`：输入合法但没有显式和声提示，仍可检查、明确选定并提交 full。

`POST /projects/{project_id}/jobs/cover` 的 CoverCreate 包含 Generate/GFS的 style、lyrics、seed、max_seconds（0–360，0 为自动）、abc、source_score_id、parent_version_id，以及 reference_asset_id、mode、effective_abc_sha256、mode_transform_version。mode 支持 melody/full。hash/revision必须等于刚才实际选定的有效输入；应用不会静默换成另一份。

选定 Score链必须属于同一 Project，关联该 Reference，并最终指向它已完成的 Transcribe Job。parent必须是该 Reference实际source Version，或上传参考的null；任意同项目parent不能代替来源。换参考、source Score或草稿后重新检查选定，即使文本相同。

## 运行、检查与显式保存 {#result}

提交返回202 JobRead/operation Cover。原有 Job HTTP/WS、取消与重试路径继续使用同一串行队列。`/runtime/capabilities` 的 Cover `supported_modes` 来自当前真实cot枚举与注册模式的交集。只有full时可明确提交full，只有melody时可明确提交melody；无可用模式、选定模式缺失、观测过期、版本或模型不可用时拒绝，没有模式/Generate回退。

Job/Candidate保存原始请求，provenance保存与 mode 一致的 actual `cot=melody` 或 `cot=full`、original/effective ABC与hash/revision，以及 reference→原始转谱→保存编辑的来源链。新任务使用 Cover registry2.0.0；已交付1.0.0的定义及历史快照保留，重启使用原冻结proof。返回 Score必须匹配冻结effective hash。音频经完整FLAC解码与应用导入后才产生 Candidate；明确 `/versions` 保存继承冻结parent，旧记录和文件不变。

## 失败与未知回执 {#recover}

- `score_invalid` / `cover_selection_mismatch`：保留文本，修正后独立保存并重新检查选定。`cover_source_mismatch` / `source_parent_mismatch`：选择真实来源链。
- `capability_missing` / `model_missing`：重新检查当前模式和资源，不转换成另一个operation。
- 初次Cover POST回执不明：读取项目Job及actual输入；初次生成没有公开幂等key，不能自动重发。
- failed/cancelled：中间Score仍可用；确认原native attempt安全终态后，已有 `/jobs/{id}/retry` 创建新Job，保留原mode/source/ABC，不重新转谱。
- `reference_commit_unconfirmed`：先读回resource_id的Asset/origin，或明确重放同一save_id/source Version。提交前失败不会留一个成功但无文件的Reference。
- 输出Score不一致、导入或推理失败：无新Candidate/Version；原素材、中间Score和旧结果保留。服务重启读取原冻结proof，不能按新registry重建并再次提交。

完整字段、返回与限制见[API合同参考](../reference/api.md)。本地CPU验证与真实GPU验收分别记录；文本一致不能证明音频逐音或和声准确度。
