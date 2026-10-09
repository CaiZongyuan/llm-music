# 通过 Runtime API 生成固定音频

本指南仅覆盖 P0 的独立验证工具。在仓库根目录执行；真实请求仅由 GPU resource owner 运行。先完成 [Runtime 准备](runtime-doctor.md)，保留就绪 Doctor、受控 Runtime PID 和日志。此工具不启动 Runtime、不下载模型、不创建正式 API/Web，也不打开 Canvas。

## 先检查固定请求

```powershell
uv run --no-project --python 3.12.13 python runtime/comfyui/p0/generation.py prepare --output-dir data/runtime/p0/generate-prepared
```

检查该目录的 `input.json`、`request.json`、`manifest.json` 和 `report.json`。固定输入包含本仓库原创歌词、风格、seed `2026100701` 和 35 秒上限（P0 闸门保持已验证区间；应用层 `max_seconds` 可在 0–360 自选，0 为自动）；接受的实际音频时长为 30–40 秒。`workflows/generate/` 保存版本化的 API-mode graph、输入映射和输出映射。已有输出目录不会被覆盖。

初始设置为 BF16、offload=on、low_vram=false、keep_model_loaded=false、cot=full、标准 VAE 和稳定默认 sdpa。YuE2 骨干使用非量化 BF16 权重；标准 VAE 按锁定插件实现以 FP32 执行。download=off、vocals_only=false；没有 Writer、ASR、LoRA 或其他附加模型路径。

## 执行一次真实请求

仅 GPU owner 可以替换下列 Runtime 路径和 PID。模型目录必须是当前受控 Runtime 使用的同一目录。日志参数可重复，以保留 stdout/stderr 在本次请求期间追加的原始内容。

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/generation.py run --output-dir data/runtime/p0/generate-baseline --url http://127.0.0.1:8188 --models-root data/models --runtime-root runtime/comfyui/.upstream/ComfyUI --process-pid <OWNED_RUNTIME_PID> --doctor-report <READY_DOCTOR_JSON> --runtime-log <RUNTIME_STDOUT_LOG> --runtime-log <RUNTIME_STDERR_LOG> --run-kind cold
```

工具检查完整模型 SHA256、Runtime 元数据、源代码提交、实际节点 schema、PID 对应的 Runtime 主程序和空队列，然后只提交一次 `/prompt`。它等待该 request 的 history，通过 `/view` 导出音频，并通过 `/yue2/score/read` 解析 Score。音频每帧都必须可解码、时长必须处于基线范围；ABC 必须包含可解析的完整小节和有效音高。单个 HTTP 200 或文件存在不能算成功。

成功退出码为 0；失败为 1，并在已建立的输出目录内保留输入、请求、history、日志与错误。参数错误由 argparse 返回 2。工具不会自动重试推理，也不会调用 `/interrupt`。`report.json` 的 `p0_passed` 始终为 false。

试听导出的 `audio.flac`，检查 `score.abc` 与完整 `score-read.json`；记录实际试听意见。解码通过不代替试听，报告的 listening_review 仍为 pending。验证结果与当前限制见 [维护记录](../verification/api-generation.md)。

## 读取资源与时间报告

- `memory-samples.jsonl` 保留 UTC 时间和逐次读数。默认每秒取样，可用 `--sample-interval` 改变；报告同时保留实际最大取样间隔。采样峰值是可观测下界，不能保证捕获两个样本之间的峰值。
- 设备读数来自 `/system_stats`。Comfy 的 vram_free 包含未使用的 Torch reservation；工具减去 torch_vram_free 重建 CUDA free，再计算整个设备的使用量。另保留 Comfy 可用量代理、Torch active allocator 子集、整机 RAM，以及指定 Runtime PID 的 RSS。锁定 Comfy 的 torch_vram_free 为 reserved−active，因此 legacy `runtime_torch_allocator_allocated_bytes` 实际重构 native `active_bytes.all.current`，包含 awaiting-free blocks，不等于严格 `memory_allocated()`；字段名与数值公式保留兼容。设备和整机值包含其他消费者；WDDM 进程 GPU resident memory 明确 unavailable，不能用设备总量代替。
- RTF 为 history 的 execution_start→execution_success 秒数 / 完整解码的音频秒数。该计量包含 Workflow 保存节点，不是 model-only RTF。另记录客户端等待与验证时间；预先校验权重的读取不在该时间内，会影响文件系统缓存。
- 同一请求日志有唯一插件 summary 时，记录其四个阶段的 0.1 秒舍入值。插件的 “loading and the rest” 包含加载、卸载和其他工作；exclusive model_load 保持 unavailable。缺日志或存在歧义时阶段值保持 unavailable。不会把加权 progress bar 当作真实总体百分比。
- `cold` / `repeat` 是调用者对当前 Runtime session 的声明，不代表服务器冷启动。history 的 execution_cached 会保留；核心 Generate 节点命中 DAG cache 时保留输出，但拒绝生成性能结论。keep_model_loaded=false 不关闭 DAG cache。不能默认相同 seed/输入的重复请求执行了新推理。

## 失败恢复

模型、版本、节点 schema、PID 或队列不符时，先恢复锁定环境和受控资源，再重新准备新输出目录。音频或 Score 无效时保留原结果；不要通过改变多个推理参数掩盖问题。等待失败后 request 可能仍在运行，GPU owner 应先查询该 request 的 history/queue。

只有实际基线 OOM 后，GPU owner 才可以保留全部原输入并重试：

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/generation.py run --output-dir data/runtime/p0/generate-low-vram --low-vram-after-oom data/runtime/p0/generate-baseline/report.json <THE_SAME_RUNTIME_AND_MEASUREMENT_OPTIONS>
```

此开关要求 OOM 失败报告、相同输入、Workflow 与全部原基线设置，唯一推理差异为 low_vram。原失败不会被覆盖。比较两个 report 的资源、耗时、输出 hash 和实际试听事实；不使用社区数字作为本机通过结论。

## 无 GPU 行为检查

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -p test_generation.py -v
```

测试仅访问隔离的本地 fake HTTP 服务和临时小文件。fake 报告不能证明真实 GPU 生成或解锁 P0。
