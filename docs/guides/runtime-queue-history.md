# 验证串行队列、history 和排队取消

此 P0 工具连续提交四个已锁定 Workflow 请求，精确删除一个排队项，再通过 queue、history、执行时间和实际产物核对结果。不创建正式产品 API/Web，不需要 Canvas。

## 运行完整验证

在仓库根目录操作。先完成 [Doctor](runtime-doctor.md)、[API 转谱](runtime-transcription.md) 和 [API 生成](api-generation.md)。保留真实启动前 Doctor JSON，保持锁定 Runtime 运行。当前 GPU resource owner 独占提交与取消，运行前队列必须为空。

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/queue_history.py run --doctor-report data/runtime-readiness.json --output-dir data/p0/queue-history/run-01
```

输出目录须不存在或为空。默认地址为 `http://127.0.0.1:8188`，确认窗口为 `--timeout 1800` 秒，queue/history 轮询间隔为 `--poll-interval 0.2` 秒。工具不会同步依赖、下载模型、重启 Runtime 或自动重试提交。

| 顺序 | 请求 | 输入条件 |
| --- | --- | --- |
| A | Generate | 既有 style/lyrics，seed `2026101701`，其余已验证设置不变。 |
| B | Transcribe | 原创 CC0 16 秒 WAV 的 polarity variant；ASR 关闭，download off。 |
| C | Generate | seed `2026101702`；仅作为 queued 删除目标。 |
| D | Generate | seed `2026101703`；确认取消后后续任务仍成功。 |

生成复用现有 30–40 秒 Workflow、Score parser 和完整音频 decoder。转谱复用既有 ABC/MIDI 导出及 public reader。请求的 Runtime prompt id 与独立 client id 持久保存在 `run-map.json`，每次提交后立即更新。最终 history 的 id、client id 和 graph 必须与该映射一致。

B 由 [queue_fixture.py](../../runtime/comfyui/p0/queue_fixture.py) 将原始 PCM 样本逐个乘以 `-1`，保留节奏、音高和时长，记录该新输入条件。WAV SHA256 为 `877fcbe4179be5f893d547c2947fd212ae50de97cde2724eead2474c5ad6f69f`。锁定插件的 `track_of → edits.audio_mark` 在特征提取前对 float32 waveform bytes 和采样率取 hash，Sage 结果缓存使用此 recording key；本次不同样本 hash 可避开此前原始录音的缓存。新 seed/polarity 是明确的输入变化，不用于性能比较。

## 如何判断成功

工具只发送 `POST /queue {"delete":[C 的精确 prompt id]}`。先检查 C 的本次 run/client 归属、pending 状态及缺少 history；该 endpoint 在锁定版本中只删除 pending 项，返回空 `200`，不触发 running interrupt。

`200` 不是删除证明。工具读回 queue/history；若目标已 running、已有 history 或仍 pending，则保留真实结果，不能声称 queued 取消。完整验证还等待 A/B/D 终止和最终空队列，核对 C 始终没有 history，才将 `never_started_proven` 设为 `true`。期间观察到多个 running 项或外国请求时立即停止成功判定。

A/B/D 必须有正耗时，执行区间按 A→B→D 有序且不重叠。全部产物经过原始 Score 解析、MIDI 读取或音频完整解码；核心推理 cache hit 不得充作新推理。成功退出 `0`，`report.json` 为 `verified=true`。`p0_passed` 始终为 `false`，running 取消与连续重复/清理仍需后续验收。

主要证据为 `run-map.json`、`queue-events.jsonl`、`cancellation.json`（删除动作时的快照）以及 `report.json`（最终证明）。A/B/C/D 子目录保存实际请求；存活项保存完整 history 和有效产物。receipt 保留 Source/Model/Workflow revisions、源码与请求 hashes、新 seed/音频条件和执行区间。Root 另行保留连续 PID 和本次日志片段，确认首次 GPU 推理与 queued 目标从未执行。

插件另有独立八条 Sage 结果缓存，`keep_model_loaded=false` 不清空它。以后重复此工具的相同 seed/polarity，不自动代表新的 GPU 工作。公开 history 不暴露 Sage 结果缓存；首次新条件的服务进度和 GPU 日志仍是实际验收依据。该工具没有连续资源 sampler，不能声称 peak VRAM/RAM 或性能改善。

## 有界恢复

失败退出 `1` 并保留映射和已取得的证据。参数/目录冲突退出 `2`。超时或断联后，已接受的请求可能仍在运行；不要重新执行整个 demo 造成重复提交。

若已知本次目标仍 queued，可使用单独恢复入口：

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/queue_history.py cancel-queued --run-map data/p0/queue-history/run-01/run-map.json --target C --output-dir data/p0/queue-history/cancel-check-01
```

此入口仍核验归属，仅 exact pending delete。观察到 pending 移除时退出 `0`，但 `never_started_proven=false`；它不替代完整最终证明。目标 running/已完成/归属不明时返回诚实 no-op 或失败，绝不升级到 `/interrupt`、`/api/jobs/.../cancel`、clear queue 或 clear history。由 owner 查询保存的 ids 和实际服务状态，再决定等待或后续有归属保护的 running-cancel 流程。

无 GPU 的公开行为检查：

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v
```

fake HTTP 可证明控制逻辑，不能替代真实 GPU 队列验收。[验证记录](../verification/runtime-queue-history.md) 区分已执行检查与待验证结果。
