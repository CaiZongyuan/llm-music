# 通过应用 API 查询 Runtime 与模型诊断

只访问本地 FastAPI 即可读取 backend/runtime health、每项能力的就绪条件、Model Registry、带来源与时间的指标和应用 Job 队列。先创建 [Morning song 项目并上传参考音频](api-project-audio.md)。Runtime 失联或权重无法校验时，Project 和 Reference Audio 的创建、读取与下载仍使用独立的 CPU API。

## 取得第一份诊断

从仓库根目录使用独立 API uv 项目。默认 `fake` 模式提供明确标识的 CPU 结果 fixture；真实 Runtime 使用自己的数据目录和 `comfyui` 模式。

```powershell
uv sync --project services/api --locked --python 3.12.13
$env:MUSIC_API_RUNTIME_MODE = "comfyui"
$env:MUSIC_API_RUNTIME_URL = "http://127.0.0.1:8188"
$env:MUSIC_API_RUNTIME_EVIDENCE_PATH = "D:/OWNER/runtime-evidence/current.json"
uv run --project services/api --no-sync music-api serve --data-dir data/application-comfy --port 8000
```

填写 owner 实际收据路径。尚无 Runtime 或收据时也可启动 API；诊断明确返回未就绪。默认只绑定 `127.0.0.1`。打开 `http://127.0.0.1:8000/docs`，或在第二个终端运行完整只读示例：

```powershell
uv run --project services/api --no-sync python services/api/examples/runtime_diagnostics.py --output data/diagnostics/first.json
```

输出文件必须尚不存在。示例读取五个公开接口并保存原响应，不创建 Project/Job、不提交推理。完整源码：[runtime_diagnostics.py](../../services/api/examples/runtime_diagnostics.py)。每次请求取得自己的 snapshot；它们没有共同的原子取样时刻。

## 读取状态与来源

| 接口 | 当前结果 |
| --- | --- |
| `GET /health` | backend HTTP process 的版本/时间，Runtime reachable、按当前能力条件计算的 ready、绑定状态与恢复原因 |
| `GET /runtime/capabilities` | Transcribe/Generate 每项 `ready`、required models、source/time、原因和动作；提交使用同一个 Runtime predicate |
| `GET /runtime/models` | 预期 revision/hash/size、provider、repository、组件、权重许可与来源；当前 state、最后观测 hash/time；独立 code registry 许可事实 |
| `GET /runtime/diagnostics` | 各原始来源时间、新鲜度、GPU 名称、版本、byte 单位的内存范围、loaded models、通用文件清单和应用队列 |
| `GET /settings/metadata` | 真实 Pydantic Settings JSON schema、默认值、描述、限制和生成的环境变量名称；不返回当前环境变量值 |

backend `ready` 表示此应用 HTTP process 正在响应。Runtime `ready` 表示至少一项 operation 满足当前条件；提交仍检查所选 operation、输入和同一 predicate。它不会替代 Job 的实际完成、输出导入与读取验证。

每个 `observation` 保留来源的 `observed_at`、`age_seconds`、`freshness` 和当前 `max_age_seconds`。顶层 `checked_at` 是此次诊断时间，不会更新旧 hash、节点或指标的来源时间。过期值可保留历史数值，但 `availability=unavailable`。缺数据保留 `null`；实际观测到的零值仍可用。

默认新鲜度策略为 300 秒，环境变量 `MUSIC_API_DIAGNOSTICS_MAX_AGE_SECONDS` 可以配置正数。这是证据窗口。当前 HTTP 失败、缺 GPU/节点、模型缺失、无效 hash、变化的指纹、失配/无法读取的进程绑定和过期来源都使能力未就绪。新保存的旧收据仍为 stale。

## 校验模型与指标

Runtime owner 用 [CPU 收据收集命令](../reference/runtime-evidence.md) 校验实际 listener PID/create time、选定入口、model root、clean source pins 与完整权重 SHA256。API 请求只读收据并检查当前身份和轻量文件指纹。窗口过期时 owner 重做实际验证；不可只修改时间。

通用 `/models` 只给 ComfyUI 文件名。锁定 YuE2 插件使用独立 `YUE2_MODELS_ROOT`；空通用清单可以与 ready 权重并存。清单不证明 hash 或 loaded 状态。Model Registry 复用 [models.json](../../runtime/comfyui/models.json) 和 [runtime.json](../../runtime/comfyui/runtime.json) 的已固定事实：YuE2 checkpoint 内含标准 VAE 和 tokenizer；权重 CC-BY-NC-4.0 与 Runtime/plugin code licenses 分开记录，独立 tokenizer 许可保持 unspecified。

内存字段写明 scope 与 bytes。CUDA device 值覆盖所有进程；Comfy availability proxy 包含可复用 Torch reservation。`runtime_torch_active_bytes` 重建 `active_bytes.all.current`，包含 awaiting-free blocks。它不是严格 `memory_allocated()`。系统 RAM 保留 Runtime/platform/cgroup 范围。当前 source 不提供的 process RSS/GPU resident memory、loaded models、driver/CUDA version 保持 unavailable。[来源参考](../reference/runtime-evidence.md) 给出锁定代码出处。

`application_queue` 来自当前 SQLite 查询，Job row 时间仍用最后写入时间。`recorded_running_job` 表示单一最后记录为 running 的应用 Job；其 source 过期时不可当作当前确认。Native occupancy 未被当前 adapter 观测，保持 unavailable。Job response 仍使用应用 id；prompt/node/完整 argv/env 不进入诊断输出。

## 恢复一次失败

如果 Morning song 的 capability 返回 `runtime_unavailable`，保留原 Asset id。由 Runtime owner 恢复本地服务后重新查询 health/capabilities；原音频仍可通过 Project Asset content 下载。

如果模型为 `missing/downloading/invalid/unavailable`，查看 `reasons` 与最后 hash/time。owner 恢复注册文件、权限或 clean pins，运行 collector 产生新的实际证据，再刷新。API 的转谱提交会以同一条件返回非成功响应和 recovery；拒绝不会偷偷发送 native `/prompt`。开发 traceback 留在日志。

读取型诊断在 Runtime 未就绪时返回 HTTP 200 的状态数据。应用元数据暂不可读时使用统一 `503 metadata_unavailable`；请求参数错误使用 `422 invalid_request`。操作成功与真实 GPU/音乐效果需分别验证。验证范围见 [维护记录](../verification/api-runtime-diagnostics.md)。
