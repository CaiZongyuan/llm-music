# 一条命令打开本地工作台

此指南面向需要启动本地工作台的维护者。普通开发使用隔离 CPU Fake Runtime；真实生成使用已准备的 ComfyUI。打开工作台后，按[项目与素材指南](web-workspace.md)创建 Project、上传参考音频。

## 前提与首次启动

在仓库根目录执行命令。需要 Git、Node、pnpm 和 uv。先执行 `pnpm install --frozen-lockfile`、`uv sync --project services/api --frozen`。API 使用自己的 `.venv` 和 `uv.lock`。Fake 模式不安装 Torch、不准备模型、不启动 ComfyUI。

<<< ../../scripts/examples/dev-fake.ps1

启动器先构建生成的 API client，再启动独立 API 和 Web，等待 HTTP 健康检查。成功后输出 `Web ready: http://127.0.0.1:5173`，`--open` 打开该地址。Web 只通过 `/api` 代理连接 FastAPI。Fake 模式的 Runtime 在 API 进程内；合计两个服务进程。它使用 CPU 测试素材，生成音频为 440 Hz 测试音，不能用于判断音乐质量。

默认 API 端口为 `8000`，Web 为 `5173`，真实 Runtime 为 `8188`。全部绑定 `127.0.0.1`。使用 `--api-port 18045 --web-port 18046 --runtime-port 18047` 可选择另一组互不相同的端口。启动器不会自动寻找其他端口或把 Web 指向未知服务。

## 数据、复用与停止

Fake 应用数据默认位于 `data/dev/fake/application/`；真实模式位于 `data/dev/comfyui/application/`。使用 `--data-dir PATH` 指定持久数据目录。删除该目录会丢失相应 Project、Asset 和 Version；停止服务不会删除数据。

每次启动输出唯一 `Session receipt` 路径。会话记录模式、进程 PID、创建时间、实际命令、端口、目录、已启动与已复用服务。稳定服务登记位于 `data/dev/<mode>/launcher/`，使用 `--state-dir PATH` 可隔离另一个启动组。服务日志、owner、停止确认和最终清理结果保留在该会话目录。

再次用同一配置启动时，启动器核对登记、实际 PID/创建时间、命令、工作目录和本地监听身份，再检查健康状态。匹配服务会显示 `Reusing`，属于此前会话。配置不同、身份不可读或端口归属未知时拒绝复用。

按 Ctrl+C 停止本次启动的服务。另一个终端也可执行启动器输出的 `pnpm dev -- --stop-session "完整会话路径/session.json"`。API 和 Web 收到会话专属停止信号后正常关闭。已复用服务继续运行；其原 owner 负责停止。正常关闭有界，必要时只终止仍与已记录身份一致的本次子进程，并在 `forced_processes` 中记录。原生 Runtime 另记录 `forced_pids`；不能把强制终止称为正常关闭。

## 使用真实 ComfyUI

仅 GPU resource owner 启动真实 Runtime。先按[Runtime 准备指南](runtime-doctor.md)准备独立 `runtime/comfyui/.venv`、锁定代码和模型。在没有现有 Runtime 的情况下，用 `pnpm dev -- --mode comfyui --open` 启动三个独立服务：Runtime uv、API uv、Web pnpm。启动前运行现有 Doctor，模型校验通过后启动 Runtime；启动器为本次 listener 收集 owner receipt，API 再验证实际就绪。启动器不同步 Runtime 环境、不下载模型。

已有 Runtime 时，使用以下受控例子。在 PowerShell 调用该脚本时传入真实 `RuntimeProject`（含 `.venv`/`uv.lock` 的目录）、`RuntimeRoot`（含 `main.py` 的上游目录）、`ModelsRoot`、`RuntimeStateRoot` 和实际 listener PID。这些路径可以指向本仓库另一个 worktree 的已准备服务。`RuntimePort` 默认为 `8188`。

<<< ../../scripts/examples/dev-native-reuse.ps1

collector 验证进程、源 revision、模型 SHA256 和文件指纹。启动器重新验证 receipt、目录及监听/状态参数，并保持原始时间戳。默认有效期为 300 秒；过期或不匹配会拒绝启动，不能把旧模型状态继续当成 ready。已复用 Runtime 不属于本次 owner，退出不会中断它。API 和 Runtime 始终使用不同 uv 项目和环境；Windows 的 venv redirector 会让系统进程显示基础 Python 路径，启动器同时检查配置的 uv 环境与 collector 身份。

## 失败恢复

| 输出 | 恢复动作 |
| --- | --- |
| 端口 unknown / differently configured | 使用另一组空闲端口，或由现有 owner 停止服务。不要删除登记来把未知进程当成本项目服务。 |
| JS dependencies missing / client build failed | 运行锁定 pnpm 安装，单独执行 `pnpm --filter @llm-music/api-client build` 查看错误，再重试。 |
| Environment not prepared / uv 环境不同 | 为对应 API 或 Runtime 项目运行锁定 `uv sync`。两者不能共享 `.venv`。 |
| Native source/models not prepared / Doctor NOT READY | 按 Runtime 准备指南检查源、环境、GPU 和模型；启动器不会下载或修复权重。 |
| Native owner/model evidence refused / Runtime not ready | 使用实际 listener PID 收集新的匹配 receipt，检查模型和目录；不要改写 `checked_at`。 |
| 单服务 startup failed / 健康等待超时 | 查看会话目录的 `api.log`、`web.log` 或 `runtime.log`，修复后重试。已启动的本次服务会清理，复用服务保留。 |
| startup.lock 已占用 | 等待另一个启动器完成启动。仅在读取该锁后确认记录的 PID/创建时间已不存活时，保留或移走旧锁，再重试。 |

`--timeout` 将服务启动和健康等待限制在 1–300 秒，默认 180 秒。依赖检查和 SDK 构建也有独立上限；它们在服务启动前执行。`pnpm test:launcher` 运行真实 CPU CLI/HTTP 启停检查；[验证记录](../verification/dev-launcher.md)区分 CPU 结果与真实目标机器验收。
