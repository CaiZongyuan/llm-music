# 通过 Runtime API 转谱并导出 MIDI

此 P0 工具将固定 Reference Audio 送入 SheetSage2，保存可解析的 ABC 与可读取的 MIDI。它使用公开 Runtime API，不需要 ComfyUI Canvas，也不创建正式 FastAPI 或 Web。

## 前提

在仓库根目录操作。先按 [Runtime Doctor 指南](runtime-doctor.md) 准备锁定环境和模型。保存一次启动前 Doctor 的成功 JSON，然后启动 Runtime：

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py doctor --json | Out-File -Encoding utf8 data/runtime-readiness.json
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py start
```

只有 Doctor 退出 `0` 后才启动。Doctor 检查空闲端口，因此服务已启动时复用保存的真实成功 receipt。工具接受 UTF-8 JSON，包括 PowerShell 写入的 BOM，支持 Doctor 原始输出或 PM 的 `report` 包装格式。运行真实 GPU 请求由当前 GPU resource owner 负责，必须与其他推理串行。

## 得到 ABC 和 MIDI

保持 Runtime 运行，在另一个终端执行：

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/transcribe.py --readiness-report data/runtime-readiness.json --output-dir data/p0/transcription/run-01
```

`--output-dir` 必须是新目录或空目录。工具不会覆盖已有证据。默认生成 16 秒、48 kHz、双声道、16-bit PCM 的原创器乐 WAV。此固定输入为 CC0-1.0；[fixture manifest](../../runtime/comfyui/workflows/transcribe-sheetsage2/v1/fixture.json) 记录来源、版本与 SHA256，[生成器](../../runtime/comfyui/p0/reference_fixture.py) 定义音符、和弦及合成方法。

工具检查 readiness 的代码/模型 pins、当前服务版本、必需节点和空队列。它通过 `/upload/image` 的公开文件上传接口保存 WAV，再提交 [固定 Workflow](../../runtime/comfyui/workflows/transcribe-sheetsage2/v1/workflow.json)。此接口沿用 `image` 表单字段，但锁定版本支持音频和 MIDI 字节。转谱采用 `mode=full`、`listen=the whole song`、`device=cuda:0`；ASR 关闭，`download=off`，不下载 speech 或 writer 模型。设置与 [输入输出映射](../../runtime/comfyui/workflows/transcribe-sheetsage2/v1/manifest.json) 一起保留。

成功退出 `0`，receipt 为 `status=completed`、`verified=true`。主要产物：

- `reference.wav`：默认固定输入；使用 `--input` 时保留原文件及 hash，不复制它。
- `request.json`：实际提交的 prompt 与 client id。
- `history.json`：公开 Runtime history 的完整结果。
- `score.abc`、`score.mid`：全部校验通过后才保存为成功产物。
- `receipt.json`：输入/输出 hash、许可、Runtime/plugin/model/workflow revisions、设置、解析证据和测量范围。

工具用 `/yue2/score/read` 解析原始 ABC，拒绝空 Score 或被裁掉的不完整 section。随后用 `/yue2/score/midi` 导出，并重新上传 MIDI，用 `/yue2/midi/tracks` 读取实际文件及非空音符。HTTP `200` 或文件存在都不足以成功。

## 范围与测量

该工具只验证一次 Runtime API 转谱及产物交换。`p0_passed` 始终为 `false`。完整 P0 仍需要 Generate、queue、cancel、repeat 和 cleanup 的真实证据。

固定器乐样本检验流程与文件有效性，不证明人声或任意音乐的转谱准确率。SheetSage2 权重为 CC-BY-NC-4.0；它与输入 fixture 的 CC0 许可分开记录。当前诊断输入边界为可读取、非静音且未截断的 16-bit 单/双声道 PCM WAV，0.05–30 秒；该范围是工具的输入预算，不代表每个音频都能得到准确 Score。

receipt 记录提交到校验结束的客户端墙钟时间、可取得的 Runtime execution timestamps，以及前后 `/system_stats` 快照。没有连续采样时，peak VRAM/RAM 和分阶段耗时明确为 `unavailable`。

ComfyUI 核心转谱节点命中 `execution_cached` 时，此次检查失败。插件还有独立的八条转谱结果缓存；`keep_model_loaded=false` 只释放模型，不清空这些结果。公开 history 不暴露此缓存的状态，因此 root 必须保留首次执行的服务进度、GPU 和日志证据；重复相同音频不能直接当成新一次 GPU 推理。工具不自动取消仍在运行的任务或重启共享 Runtime。

## 失败恢复

失败退出 `1`，receipt 为 `verified=false`；已有 Runtime 请求和失败 history 保留。参数解析或目录冲突退出 `2`。失败不会登记成功 ABC/MIDI；`candidate.mid` 可能保留为未验证的诊断文件。

| 诊断 | 恢复 |
| --- | --- |
| PCM WAV 无效、静音或截断 | 使用默认固定 fixture；先核对输入内容和 hash。 |
| readiness 未验证目标 pins 或 SheetSage2 hash | 由 resource owner 恢复锁定代码/模型，并重新取得真实启动前 Doctor receipt。 |
| Runtime 不可达或版本/节点不符 | 核对地址、已锁定的服务和日志。默认地址为 `http://127.0.0.1:8188`。 |
| 队列非空 | 等待 owner 完成当前请求，不提交竞争任务。 |
| history 报告缺模型、OOM 或执行错误 | 读取 `history.json`、`failure-response.json` 和服务日志；修复后用新的输出目录重试。 |
| 超过 `--timeout`（默认 1800 秒） | 请求可能仍在运行。核对保存的 prompt id、history 与 queue，再由 owner 决定是否取消或等待。 |
| Score/MIDI 空、无效或 section 不完整 | 保留请求、history 和 parser 响应，检查实际模型结果；不要将候选文件标记为成功。 |

无 GPU 的可重复检查：

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v
```

这些测试使用隔离的 fake HTTP 服务，不能解锁 P0。实际执行状态见 [转谱验证记录](../verification/runtime-transcription.md)。
