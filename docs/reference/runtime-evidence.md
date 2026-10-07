# Runtime 诊断证据来源

应用 API 环境不运行 Doctor、不导入 Torch/CUDA，也不对大型权重重新计算 SHA256。Runtime adapter 读取当前公开接口；本机 owner 提供独立的只读校验收据。收据输入以 [RuntimeReceipt](../../services/api/src/music_api/runtime_evidence.py) 的 Pydantic schema 为准。

## 收集一份可复核的收据

在 Runtime 所在主机收集事实。使用实际配置的 loopback URL、当前 listener PID 和同一 Runtime 使用的模型根目录。不要将历史 Doctor 的 `ready=true` 改成当前证明。

从仓库根目录，owner 在独立 CPU API 环境执行以下命令。填写实际 listener PID，不能使用 uv/venv launcher 的 PID。

```powershell
uv run --project services/api --no-sync python -m music_api.runtime_evidence collect --runtime-url http://127.0.0.1:8188 --pid <ACTUAL_OWNED_LISTENER_PID> --output data/runtime-evidence/current.json
```

命令不提交推理、不调用 CUDA，也不修改权重。它完整重算 hash，核对当前绑定和 clean source；成功退出 0。缺失、下载中或 invalid 权重写入明确状态并退出 1；身份、权限、源码或哈希期间文件变更使收集退出 1，并保留原收据。刷新同一输出会先保存 `current.previous.<旧来源UTC时间>.json`，再原子替换当前收据。API 请求只读取当前收据和轻量当前检查，不自动运行此命令。

1. 查明该 URL 端口的实际 listener PID。读取进程创建时间、可执行文件和选定的 `main.py` 入口；只读取 `YUE2_MODELS_ROOT`。不要保存或输出完整命令行或环境。
2. 确认 Runtime 与插件 checkout 的实际 revision，并确认 tracked files 没有变更。许可和预期 revision 来自 [runtime.json](../../runtime/comfyui/runtime.json)；权重 revision、大小、SHA256 与许可来自 [models.json](../../runtime/comfyui/models.json)。
3. 对每个注册模型解析实际 Runtime layout 路径。保存哈希前的 resolved path、大小与 `mtime_ns`，计算完整文件 SHA256，再取一次指纹。两次指纹必须一致。
4. 将每个模型的 `checked_at` 设为本次哈希完成的 UTC 时间，将顶层时间设为本次收集完成时间。保留实际来源说明。重新读取或另存 JSON 不更新这些来源时间。
5. 将 schema 验证过的收据保存在与应用数据库、Assets 分开的 owner 管理路径。应用只读取收据；写入或替换模型由 owner 显式处理。

| 字段 | 内容 |
| --- | --- |
| `schema_version`, `mode`, `runtime_url`, `source`, `checked_at` | 版本 1、`comfyui`、实际 loopback endpoint、来源、带时区的来源时间 |
| `runtime_root`, `models_root`, `runtime_revision`, `plugin_revision` | 实际 checkout、模型 layout 与源码 revision |
| `process` | `pid`、`create_time`、`executable`、`entrypoint`；不含完整 argv/env |
| `models[]` | 注册 id、`missing/downloading/ready/invalid`、revision、时间、实际 hash/size 和文件指纹 |
| `models[].fingerprint` | `resolved_path`、`size_bytes`、`mtime_ns` |

## 当前授权与历史事实

新鲜度是明确的配置策略，默认窗口为 300 秒。读取收据的时间与来源时间不同。新写入但来源时间已过期的文件仍为 stale；未来时间、外部 URL、不同 Runtime mode/revision、被复用的 PID、不可读取身份或变化的模型指纹都不能证明当前就绪。

当前健康检查、节点和实际模型 layout 可以否定旧的 ready。`/models/{folder}` 只列通用 ComfyUI 文件名，不能证明已加载或 SHA256 有效。锁定的 YuE2 插件从独立的 `YUE2_MODELS_ROOT` 获取权重；因此通用清单为空也不能证明这些模型缺失。只有 registry 明确映射到该清单的模型才能使用其缺失信息。当前 YuE2/SheetSage2 以本机绑定、实际 layout 和来源校验为准，且只在配置窗口内参与同一个提交就绪判断。未变化的 stat 指纹不会成为永久的密码学证明。拒绝当前授权时保留最后校验的 hash 和来源时间作为历史诊断。

## 读取指标

锁定的 ComfyUI `/system_stats` 提供版本、Runtime 所报系统 RAM、设备字段和 Torch allocator 字段；它不提供 PID 或模型加载清单。数据结构来源为 [锁定的 server.py](https://github.com/Comfy-Org/ComfyUI/blob/7a5dad695fe1cae25efcb2550530fb20ef68da3d/server.py)，计数含义来源为 [model_management.py](https://github.com/Comfy-Org/ComfyUI/blob/7a5dad695fe1cae25efcb2550530fb20ef68da3d/comfy/model_management.py)。

CUDA 的 `vram_free` 包括 Torch 可复用 reservation；`torch_vram_total` 是 reserved，`torch_vram_free` 是 reserved−active。active 来自 `active_bytes.all.current`，不能标为严格 `memory_allocated()`。设备、系统 RAM 与进程值分开报告。无法观测的 loaded models、进程 GPU resident memory、驱动或 CUDA 版本保持 unavailable，不用设备总量或文件名替代。

API-only fake peer 验证来源和失败行为；真实事实由 Runtime owner 另行验证。它们都不构成音乐质量、性能承诺或完整阶段验收。
