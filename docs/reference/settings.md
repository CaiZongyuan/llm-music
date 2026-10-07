查阅应用 API 的环境变量、默认值与校验限制。下方字段直接来自真实 Settings 的 JSON Schema，不读取你当前的环境变量，也不连接 Runtime。它不包含 ComfyUI 或模型环境配置。

## 选择独立的应用数据目录 {#usage}

在仓库根目录操作。Node、pnpm、uv 与独立 API 环境的准备见[客户端指南](../guides/api-client.md#prepare)。以下可选示例仅启动隔离的 fake 应用 API，适合练习业务操作；fake 不产生模型音乐。

```powershell
$env:MUSIC_API_RUNTIME_MODE = "fake"
$env:MUSIC_API_DATA_DIR = "data/reference-example-fake"
uv run --project services/api --no-sync music-api serve --port 8000
```

从 `/health` 的 `runtime.mode` 核对模式，再创建 Project；退出自己的 API 进程后，本地数据仍保留。运行时变量不通过此文档写入。若数据目录已属于其他模式，选择新的目录；不要把 fake 项目目录切成真实模式。真实模式需要独立目录和新鲜的 owner receipt，按[诊断指南](../guides/api-runtime-diagnostics.md)准备。完整操作与失败恢复见[生成与保存](../guides/generate-save-api.md)、[重启恢复](../guides/job-recovery.md)。

## 读取元数据 {#source}

事实来源是[应用 Settings](../../services/api/src/music_api/config.py)；生成器复用 [Settings metadata](../../services/api/src/music_api/diagnostics_routes.py) 的字段与环境变量映射。`${REPOSITORY}` 表示当前 checkout 根目录；生成器从实际 Path 默认值推导这个可移植标记，不公开机器绝对路径。JSON 区块保留类型、默认值、可选值与数值边界；没有默认值时不编造默认值。

`data_dir` 下的 `app.sqlite` 与 `assets/` 是 Settings 派生的应用存储位置。上传字节/秒数预算不代表模型支持相同时长，实际能力见[当前能力](../learn/scope.md)。读取配置不刷新 Runtime 诊断证据。变量不满足字段约束时，API 启动会拒绝配置；修正变量后重新启动自己的进程。生效值还可能由启动命令的显式参数覆盖，例如 `--data-dir`。

<<< @settings
