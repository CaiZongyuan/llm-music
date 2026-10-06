# 验证运行中取消与后续推理

此 P0 命令通过锁定 Runtime 的原生 API 精确取消一个本次拥有的 Generate 请求，再验证后续 Generate 成功。正式产品 API/Web 尚未开始。

## 运行完整验证

在仓库根目录操作。先完成 [Doctor](runtime-doctor.md)、[转谱](runtime-transcription.md)、[生成](api-generation.md) 和 [队列验证](runtime-queue-history.md)。保留 ready Doctor JSON，并保持同一锁定 Runtime 运行。GPU resource owner 独占本次提交与取消；初始队列必须为空。

`--runtime-log` 指向该 Runtime 正在写入的 stderr 文件。替换示例中的日志和既有产物路径；工具只读这两个文件。

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/running_cancel.py run --doctor-report data/runtime-readiness.json --runtime-log data/runtime/comfyui/server.stderr --preserve-artifact data/p0/generate/run-01/audio.flac --output-dir data/p0/running-cancel/run-01
```

输出目录须不存在或为空。可重复传入 `--preserve-artifact`，核对既有音频/Score 的前后 SHA256。默认本地地址 `http://127.0.0.1:8188`，各确认窗口 `--timeout 1800` 秒，轮询间隔 `--poll-interval 0.2` 秒。每次 sleep 不超过剩余确认时间；HTTP 请求保留既有客户端连接超时。工具不安装依赖、下载模型、重启 Runtime 或重试提交。

| 顺序 | 实际条件与证明 |
| --- | --- |
| A | 复用既有 style/lyrics、35 秒生成预算和其余推理设置；seed `2026101801`。提交前保存 stderr 文件 identity 和结束 byte offset。 |
| 取消 A | 等待新 `Writing the score` 标记；读取前后 A 都必须是唯一 running 项，prompt/client/graph 与本次保存映射一致，且没有 pending 项。此时尚未提交 B。 |
| B | 仅在 A 有确切取消终态、队列为空后提交；seed `2026101802`。B running 时再次取消已终止 A 两次，原生返回必须为 `cancelled=false`。 |
| 最终结果 | B 有成功 history、正执行时间、有效 Score 和完整可解码的 30–40 秒音频；最终队列为空，声明保留的既有产物 hash 不变。 |

新 seed 是声明的输入变化，用来区分此前的请求，不作为性能比较。`run-map.json` 每次成功提交后立即保存独立 run/client/prompt/graph 映射。每个请求先写 `request.json`；若提交响应丢失，保留尝试记录，不能盲目重发。

## 如何判断取消完成

工具只发送 `POST /api/jobs/{精确拥有的 prompt id}/cancel {}`。锁定 Runtime 在 queue mutex 内匹配当前 id 并派发中断。客户端快照到请求之间若发生队列切换，该原生匹配不会中断另一个 id。不会调用全局 `/interrupt`、clear queue 或 clear history。

原生 `cancelled=true` 仅表示 dispatch。只有目标 history 的 prompt/client/graph 匹配、`status_str=error`、含同一目标的 `execution_interrupted`，且 `GET /api/jobs/{id}` 返回目标 `status=cancelled`，才设置 `terminal_confirmed=true`。真实中断 history 可以是 `completed=false`。普通 `execution_error` 保留为 failed；迟到 dispatch 后实际 success 保留为 completed；无 terminal history 时保持未确认。

阶段日志没有 prompt id，所以只在独占单 worker、A 前后归属一致、本次新 byte 区间内归因。旧标记不触发。日志 rotation、identity 变化或已检测到 truncation 拒绝触发；不得从 offset 0 重读。观察条件未满足时停止，不改用固定延迟或全局中断。resource owner 还须保留 Runtime PID 与日志来源连续性。

完整验证成功退出 `0`，`report.json` 为 `verified=true`。`p0_passed` 始终为 `false`，连续重复和清理仍需后续验收。该 receipt 保留原生响应、history、queue、日志 byte 区间、源码/模型/Workflow hashes、B 产物及 `/system_stats` 点快照。点快照不代表 peak、进程专属显存或已完全释放 GPU 内存。真实 GPU、loader cleanup 和后续推理事实由同次日志及实际运行记录补足。

## 有界恢复

失败退出 `1` 并保留已接受的映射和证据。参数或目录冲突退出 `2`。超时/断联后，原请求可能仍 active。先查询保存的 id；不要重跑完整 demo。

若确认本次拥有的目标仍 running，可单独调用有归属保护的恢复命令：

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/p0/running_cancel.py cancel-running --run-map data/p0/running-cancel/run-01/run-map.json --target A --output-dir data/p0/running-cancel/recovery-01
```

归属不明或 running 行不匹配时拒绝写入。已 terminal 或非 current 时不写；最终 history 控制结果。退出 `0` 的 completed/no-op 不是取消证明，应读取 `status`、`verified` 和 `terminal_confirmed`。恢复命令不运行 B，也不证明后续推理或完整清理。

`observe-score --run-map ... --target A --runtime-log ... --output-dir ...` 是只读诊断入口。它从调用时的日志末尾等待新标记，保留相同 identity/归属检查；不读取此前标记，不提交或取消任何请求，也不设置 `verified=true`。

无 GPU 的公开行为检查：

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v
```

fake HTTP 证明调用方的取消、终态和日志归属边界；不证明 GPU、真实中断、资源释放或音乐质量。当前实际执行状态见 [验证记录](../verification/runtime-running-cancel.md)。
