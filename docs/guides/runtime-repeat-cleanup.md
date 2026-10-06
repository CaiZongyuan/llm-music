# 连续运行、清理与 P0 报告

此固定 P0 协议在同一 Runtime 连续执行十项 Transcribe/Generate，记录每项真实产物与连续资源样本，然后只发送一次 `/free` 并验证两种模型仍可工作。它不创建正式 API/Web，也不自动解锁 P1。

## 先冻结输入

在仓库根目录完成 [Doctor](runtime-doctor.md)、[转谱](runtime-transcription.md)、[生成](api-generation.md)、[队列](runtime-queue-history.md) 和 [运行取消](runtime-running-cancel.md)。保留它们的实际 receipts 和同一进程。只有 GPU resource owner 执行真实请求；不得在十项之间重启、free、清 cache/history 或重试。

```powershell
uv run --no-project --python 3.12.13 python runtime/comfyui/p0/repeat_cleanup.py prepare --ledger-root .scratch/p0-development --output-dir data/p0/repeat/prepared-01
```

prepare 只生成 CPU fixture 和 `plan.json`，无 Runtime 写。顺序固定为 T1/G1…T5/G5；随后是 G5-after-free、T6-after-free。六个原始 CC0 16 秒、48 kHz stereo PCM16 输入只将旋律移调 +1…+6 半音；和弦、bass、percussion、时长和预算保持不变。WAV SHA256、实际 decoded float32 hash 与预期 native `yue2_track` 一起登记，不能只靠新文件名/header 绕过 cache。

G1…G5 使用相同已验证 style/lyrics 和 seed 2026190101…2026190105。准备和运行前均核对实际历史 ledger；已使用的 seed/track mark 不再算新工作。settings 固定 BF16、offload on、low_vram false、keep_model_loaded false、cot full、sdpa、标准 VAE、35 秒预算和 download off。plan 的 source、graph IDs/bindings、manifest 和输入不能事后改动。

## 运行固定系列

替换示例 PID 为 owner 确认的真实 Runtime PID，`--runtime-main` 和 stderr 必须对应该进程。输出目录须为空；workspace 为独立 worktree 时，给出 root 拥有的绝对路径。

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/repeat_cleanup.py run --prepared data/p0/repeat/prepared-01 --doctor-report data/runtime-readiness.json --runtime-log data/runtime/comfyui/server.stderr --process-pid 12345 --runtime-main runtime/comfyui/.upstream/ComfyUI/main.py --ledger-root .scratch/p0-development --prior-root .scratch/p0-development --state-root data/runtime/comfyui --output-dir data/p0/repeat/run-01
```

每次提交前后检查 PID 和 create_time；仅当上项 history、完整 ABC/MIDI/audio 校验和一致 idle 窗口都结束才提交下一项。Runtime map、request、history、输入/输出 hash 和 log spans 逐项持久保存。任何 OOM、crash、timeout、归属不明、PID 更换、cache hit、无 reload/phase 日志或无效产物会停止新提交，原失败保留。不会重试、换参数凑数或自动取消仍在运行的请求。

系列 sampler 从首项前 idle 连续覆盖提交、history、产物校验、每次相同的 idle、一次 cleanup 和两个 witness；默认 sample interval 1 秒、idle 2 秒，可显式配置正数。每项 active/idle 窗口从同一 monotonic 时间原点切片，记录样本数、gap、sampled peak/min/last；空窗口不能继承全系列 peak。背景与边界采样使用同一锁，timestamp、append 和整条 JSONL 写入串行。

设备值为 CUDA whole-device total−free，校正 Comfy free 中的 unused Torch reservation；它包含其他 GPU 消费者，不是 WDDM process residency。另列 Torch allocator、Runtime RSS、whole-host RAM。sampled peaks 是下界。T processing factor 除以 16 秒输入；G RTF 除以完整解码的实际音频时长。phase-exclusive/model load 无法观测时明确 unavailable，不从百分比推算。

## Cleanup 的证明

十项全部成功且 queue idle 后，只一次发送 `POST /free {unload_models:true,free_memory:true}`。空 200 仅是 ACK。持续采样与 bounded idle 后，精确重放实际 G5 graph，保持 core、全部 ancestors、节点 IDs、seed、settings 和 bindings；只有 SaveAudio prefix 改变。若核心 cached、加载或完整阶段缺失、media 不合法，则 cleanup 未证明，不重试或改 seed。第十二项新 T6 还要求 Sage 新 mark、重新加载/Listening/Writing 和有效 ABC/MIDI。

不删除权重、Runtime upload/output/user songs 或最终证据；声明的 state root 前后保存文件 metadata。cleanup 指工作内存与 DAG reset，不是内存归零或所有 cache 消失。旧 #18 取消后高占用较晚才回落的原因仍未知，不能由 unload 日志推断即时完全释放。

## 报告与判断

`report.json`、`resource-samples.jsonl`、每项目录、`runtime-report.json/md`、`benchmark.md`、`known-limitations.md` 可复查。报告独立列出八个必需 case 的 passed/failed/unverified，旧 15–18 evidence 不算本次十项。fake evidence 不晋升为实际通过，工具始终 `p0_passed=false`。

十项成功不能单独证明稳定。`trend_review` 按 T/G 分层列 idle 原始序列，无自创阈值；持续未解释的增长保持 unverified。Root 对原始数据、样本缺口、可识别 bounded retention 和 cleanup 后状态作有证据判断，可用 `report --run-dir ... --output-dir ... --prior-root ... --assessment ...` 记录匹配本次 run id 的 status/rationale/evidence/unexplained_growth。缺少关键窗口数据或 unexplained_growth 非 false 时，不能通过 assessment 晋升 passed。最终 gate 由 root 完成实际验证、review、CI 与集成后决定；主观试听延后不是新 gate。

失败后先查持久化的 prompt/client map、queue/history 和日志。使用既有精确归属恢复入口；不整体重跑或清共享队列。所有文件保留，已接受工作可能仍在运行。

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v
```

CPU/fake HTTP 只验证工具逻辑。[实际验证记录](../verification/runtime-repeat-cleanup.md) 说明当前证据范围。
