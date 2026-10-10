# 一条命令打开本地工作台

此指南面向需要启动本地工作台的维护者。普通开发使用隔离 CPU Fake Runtime；真实生成使用已准备的 ComfyUI。打开工作台后，按[项目与素材指南](web-workspace.md)创建 Project、上传参考音频。

## 前提与首次启动 {#start}

在仓库根目录执行命令。需要 Git、Node、pnpm 和 uv。先执行 `pnpm install --frozen-lockfile`、`uv sync --project services/api --frozen`。API 使用自己的 `.venv` 和 `uv.lock`。Fake 模式不安装 Torch、不准备模型、不启动 ComfyUI。

<<< ../../scripts/examples/dev-fake.ps1

启动器先构建生成的 API client，再启动独立 API 和 Web，等待 HTTP 健康检查。成功后输出 `Web ready: http://127.0.0.1:5173`，`--open` 打开该地址。Web 只通过 `/api` 代理连接 FastAPI。Fake 模式的 Runtime 在 API 进程内；合计两个服务进程。它使用 CPU 测试素材，生成音频为 440 Hz 测试音，不能用于判断音乐质量。

默认 API 端口为 `8000`，Web 为 `5173`，真实 Runtime 为 `8188`。默认全部绑定 `127.0.0.1`。使用 `--api-port 18045 --web-port 18046 --runtime-port 18047` 可选择另一组互不相同的端口。启动器不会自动寻找其他端口或把 Web 指向未知服务。

## 开启手机局域网入口 {#mobile-lan}

先在电脑核对当前局域网网卡 IPv4，再调用以下示例，并传入 `-LanHost 实际IPv4`。`LanPort` 默认 `8001`，必须与 API、Web、Runtime 端口不同。启动器只绑定这个明确地址，不自动选择虚拟网卡，不使用 wildcard，也不扩大 ComfyUI 或 Web 的监听范围。

<<< ../../scripts/examples/dev-mobile-lan.ps1

同一 API 进程同时服务原有 loopback 和额外 LAN socket，共享 Project、Asset、Job、Candidate、Version 与队列。默认例子仍为 CPU Fake Runtime；真实音乐需要按后文准备原生 Runtime。会话记录新增 `lan_url`，API 配置签名记录 `lan_host`、`lan_port` 和允许的本地 Web Origin。地址/端口不同、其中一个监听被占用或归属不匹配会拒绝启动；复用及停止都核对两个真实 socket。

当前配对管理 HTTP 已实现。手机正式创作界面仍按移动实施票据接入。电脑可在自己的 local API 使用 `GET /pairing/owner` 读取进程 CSRF，然后带 `X-Owner-CSRF` 调用 `POST /pairing/challenges`。返回的六位码只在本次响应中显示，120 秒内允许最多五次错误；新建窗口关闭旧窗口。`DELETE /pairing/challenges/current` 关闭新配对；`GET /pairing/devices` 读取设备摘要，`DELETE /pairing/devices/{device_id}` 撤销设备。带 Origin 的浏览器管理请求必须匹配真实本地 API 或所配置 Web Origin；本机 CLI 可省略 Origin，但仍必须带当前 CSRF。

手机先安全保存自己的 UUID 与 32 字节随机 token（64 位小写十六进制），再向 LAN `POST /pairing/claim` 发送 `device_id`、`device_name`、`device_token` 与 `code`。同一次精确重放只恢复原设备；不同意图冲突。服务端只保存摘要。匿名 LAN 只可 `GET /connection` 与 `POST /pairing/claim`；其余 HTTP、WebSocket 和音频 GET/HEAD/Range 都需要 `Authorization: Bearer`。凭据放在请求头，不放 URL。撤销会关闭活动 WebSocket 并拒绝后续请求，已开始的生成任务继续运行；已送出的音频字节不能收回。默认不开 LAN 的本地业务消费者保持原有用法。

`device_id` 标识一次设备授权记录。撤销后明确重新配对，要生成新的 UUID 和 token；初次 claim 响应未知时则保留并重放原 UUID、token、名称和配对码，不能把未知请求换成另一份授权。

局域网新建 Project、Generate 与明确 retry 还需要持久 UUID `Idempotency-Key`；响应未知时查询原请求，不能自动新建另一份任务。见[请求恢复规则](generate-save-api.md#request-recovery)。

## 数据、复用与停止 {#ownership}

Fake 应用数据默认位于 `data/dev/fake/application/`；真实模式位于 `data/dev/comfyui/application/`。使用 `--data-dir PATH` 指定持久数据目录。删除该目录会丢失相应 Project、Asset 和 Version；停止服务不会删除数据。

每次启动输出唯一 `Session receipt` 路径。会话记录模式、进程 PID、创建时间、实际命令、端口、目录、已启动与已复用服务。稳定服务登记位于 `data/dev/<mode>/launcher/`，使用 `--state-dir PATH` 可隔离另一个启动组。服务日志、owner、停止确认和最终清理结果保留在该会话目录。

原生 API 从启动组内稳定的 `runtime-evidence-<端口>.json` 读取证据。输入 receipt 的文件名属于来源记录；自动生成的会话路径或另一个新文件名不会改变同一服务配置。启动器先保留输入副本并验证实际 Runtime、环境、模型和全部服务配置，再将通过验证的原始内容复制到该读取位置。原始 `checked_at` 与模型校验时间不变；后续新证据不会改写旧会话的输入副本。同配置、同 Runtime 的新鲜证据可以更新现有 API 的读取来源，复用后的进程仍属于原 owner。

再次用同一配置启动时，启动器核对登记、实际 PID/创建时间、命令、工作目录和本地监听身份，再检查健康状态。匹配服务会显示 `Reusing`，属于此前会话。配置不同、身份不可读或端口归属未知时拒绝复用。

按 Ctrl+C 停止本次启动的服务。另一个终端也可执行启动器输出的 `pnpm dev -- --stop-session "完整会话路径/session.json"`。API 和 Web 收到会话专属停止信号后正常关闭。已复用服务继续运行；其原 owner 负责停止。正常关闭有界，必要时只终止仍与已记录身份一致的本次子进程，并在 `forced_processes` 中记录。原生 Runtime 另记录 `forced_pids`；不能把强制终止称为正常关闭。

## 使用真实 ComfyUI {#native}

仅 GPU resource owner 启动真实 Runtime。先按[Runtime 准备指南](runtime-doctor.md)准备独立 `runtime/comfyui/.venv`、锁定代码和模型。在没有现有 Runtime 的情况下，用 `pnpm dev -- --mode comfyui --open` 启动三个独立服务：Runtime uv、API uv、Web pnpm。启动前运行现有 Doctor，模型校验通过后启动 Runtime；启动器为本次 listener 收集 owner receipt，API 再验证实际就绪。启动器不同步 Runtime 环境、不下载模型。

已有 Runtime 时，使用以下受控例子。在 PowerShell 调用该脚本时传入真实 `RuntimeProject`（含 `.venv`/`uv.lock` 的目录）、`RuntimeRoot`（含 `main.py` 的上游目录）、`ModelsRoot`、`RuntimeStateRoot` 和实际 listener PID。这些路径可以指向本仓库另一个 worktree 的已准备服务。`RuntimePort` 默认为 `8188`。

<<< ../../scripts/examples/dev-native-reuse.ps1

collector 验证进程、源 revision、模型 SHA256 和文件指纹。启动器重新验证 receipt、目录及监听/状态参数，并保持原始时间戳。默认有效期为 300 秒；过期或不匹配会拒绝启动，不能把旧模型状态继续当成 ready。已复用 Runtime 不属于本次 owner，退出不会中断它。

未指定 `--runtime-evidence` 的再次启动，只能复用启动组内仍有效的证据。该证据过期后，先用上述例子收集真正的新证据；复制或再次读取旧文件不会更新它的时间。不同 Runtime 进程、目录、环境或应用数据配置会拒绝复用；由原 owner 按新配置重启相应应用服务。

API 和 Runtime 始终使用不同 uv 项目和环境。启动器检查当前 Runtime 环境是否与自己的 `uv.lock` 同步，并记录 lock SHA256。它还核对实际 listener 的启动解释器路径、PID/创建时间与命令。Windows listener 常显示两个环境共用的基础 Python；这时必须找到仍存活的直接 venv redirector，证明它用所配置环境的解释器启动了同一命令。新的配置探测进程、共同基础 Python 或更远的祖先进程不能代替该来源。无法证明来源时，启动器拒绝复用并保留原服务，不猜测当前进程的 `sys.prefix`。

不同 Git checkout 的 LF/CRLF 换行差异只在四份登记配置文本的兼容性比较中归一化。文件不被重写；实际 `uv.lock` 原始字节 SHA256、已安装环境同步、进程来源、模型及源码校验保持独立。依赖或配置值改变仍拒绝。

可先运行 `pnpm dev -- --inspect-runtime-origin 实际PID --runtime-project 已准备的Runtime项目路径` 单独读取来源。该命令只查验启动路径、进程身份及当前 lock，不读取模型、连接 Runtime HTTP 或证明推理就绪。完整启动仍需要上面的新鲜 collector receipt。

## 失败恢复 {#recover}

| 输出 | 恢复动作 |
| --- | --- |
| 端口 unknown / differently configured | 使用另一组空闲端口，或由现有 owner 停止服务。不要删除登记来把未知进程当成本项目服务。 |
| JS dependencies missing / client build failed | 运行锁定 pnpm 安装，单独执行 `pnpm --filter @llm-music/api-client build` 查看错误，再重试。 |
| Environment not prepared / uv 环境不同 | 为对应 API 或 Runtime 项目运行锁定 `uv sync`。两者不能共享 `.venv`。 |
| Native source/models not prepared / Doctor NOT READY | 按 Runtime 准备指南检查源、环境、GPU 和模型；启动器不会下载或修复权重。 |
| Native owner/model evidence refused / Runtime not ready | 使用实际 listener PID 收集新的匹配 receipt，检查模型和目录；不要改写 `checked_at`。 |
| Runtime environment origin differs / unproved | 指定实际启动环境，或由原 owner 提供仍可验证的启动来源。保留原服务；基础 Python 相同不代表环境相同。 |
| Existing API native binding differs / unproved | 保留原应用服务，先核对它记录的 Runtime 来源。由原 owner 按已验证的新 Runtime 配置重启应用服务。 |
| 单服务 startup failed / 健康等待超时 | 查看会话目录的 `api.log`、`web.log` 或 `runtime.log`，修复后重试。已启动的本次服务会清理，复用服务保留。 |
| startup.lock 已占用 | 等待另一个启动器完成启动。仅在读取该锁后确认记录的 PID/创建时间已不存活时，保留或移走旧锁，再重试。 |

`--timeout` 将服务启动和健康等待限制在 1–300 秒，默认 180 秒。依赖检查和 SDK 构建也有独立上限；它们在服务启动前执行。`pnpm test:launcher` 运行真实 CPU CLI/HTTP 启停检查；[验证记录](../verification/dev-launcher.md)区分 CPU 结果与真实目标机器验收。
