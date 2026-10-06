# 准备并检查 P0 Runtime

在仓库根目录执行以下命令。此指南针对 Windows x64、RTX 3070 Ti Laptop 8 GiB。需要 Git、uv 和可用的 NVIDIA 驱动。Runtime 使用独立的 Python 3.12.13 环境；不会安装 FastAPI 或正式 Web。

## 得到第一个检查结果

准备锁定的代码和环境。此命令克隆 Runtime、自定义节点，并下载 uv.lock 声明的依赖。已有 checkout 必须与锁定提交一致且没有 tracked 修改；命令不会覆盖本地修改。

```powershell
uv run --no-project --python 3.12.13 python runtime/comfyui/manage.py prepare
```

准备模型。此命令会下载约 9.19 GB 的权重到 `data/models/`。权重为 CC-BY-NC-4.0；具体来源、revision、字节数和 SHA256 见 [Model Registry](../../runtime/comfyui/models.json)。代码许可独立记录在 [Runtime 配置](../../runtime/comfyui/runtime.json)。嵌入 tokenizer 的单独许可未确定，不从权重许可推断。

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py download-models
```

运行一条 readiness 命令。`--no-sync` 保证检查本身不触发依赖下载或环境修改。

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py doctor
```

成功输出 `Runtime READY`，退出码为 `0`。失败输出 `Runtime NOT READY`，逐项显示恢复动作，退出码为 `1`。错误的配置或参数退出码为 `2`。中断命令退出码为 `130`。加 `--json` 得到有时间戳的检查、版本事实、模型状态和恢复动作。`ready` 只表示推理前提就绪；`p0_passed` 始终为 `false`，直到后续票据完成真实 GPU 转谱、生成、排队、取消、重复任务和清理验收。

## 使用已有合法本地权重

Doctor 不会下载或移动文件。使用模型根目录覆盖默认路径，或对一个模型指定现有文件：

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py doctor --models-root D:/MusicModels --model-path yue2-bf16=D:/MusicModels/renamed-yue2.safetensors --json
```

`--model-path` 可以独立验证文件的 hash；若登记的 Runtime 相对路径不能访问同一个文件，该检查仍失败，不能得到 `Runtime READY`。在 `--models-root` 内采用登记的相对路径，或在该路径建立指向原文件的文件系统链接，然后不加 `--model-path` 重新检查。启动命令拒绝 `--model-path`，避免校验和实际加载路径不同。插件对有效 `YUE2_MODELS_ROOT` 使用独占搜索；启动前检查同一目录。

## 失败恢复

| 结果 | 下一步 |
| --- | --- |
| NVIDIA 查询失败或目标 GPU 缺失 | 安装驱动，先确认 `nvidia-smi` 能列出目标 GPU，再运行 Doctor。 |
| Torch CUDA、BF16 或版本不符 | 执行 `uv sync --project runtime/comfyui --frozen`，用此环境重试；检查 JSON 中的设备和 import traceback。 |
| Runtime revision 不符或 tracked 修改 | 先保留本地修改，再恢复配置指定提交的干净 checkout。`prepare` 不会重置已有文件。 |
| 必需节点或 lazy inference import 失败 | 检查 traceback，并恢复锁定依赖和插件代码；节点入口能 import 不等于模型代码可用。 |
| 模型 missing / downloading | 执行 `download-models`。中断数据保留为 `.part`，重新运行会续传；`.part` 不算 ready。 |
| 模型 invalid size / SHA256 | 保留或移走损坏文件后重新下载。命令不自动覆盖已有 invalid 模型；相同大小也必须通过完整 SHA256。 |
| 磁盘不足 | 在模型卷腾出空间。Doctor 要求 10 GiB 工作余量，并为尚未 ready 的模型预留下载空间。 |
| 端口占用 | 停止占用进程，或在 Doctor 和 `start` 中使用同一个空闲 `--port`。正在运行的服务会使启动前 Doctor 失败。 |

## 启动本地 Runtime

```powershell
uv run --project runtime/comfyui --no-sync python runtime/comfyui/manage.py start
```

启动前重新运行 Doctor。服务仅监听 `http://127.0.0.1:8188`，不自动打开 Canvas。使用 Ctrl+C 停止。只允许锁定的 YuE2 自定义节点包；输入、输出、用户数据和临时文件位于 `data/runtime/comfyui/`。模型、虚拟环境、上游 checkout、下载状态和 Runtime 数据不进入 Git。`start --state-root PATH` 可改变运行数据根目录；修改端口或模型目录时传入相应参数。

在独立 worktree 中工作时，用 `--models-root D:/Projects/Backend/llm-music/data/models --state-root D:/Projects/Backend/llm-music/data/runtime/comfyui` 指向 PM 管理的共享数据。只有 GPU resource owner 启动 Runtime 或运行真实 CUDA 检查；多张票据不同时运行推理。

## 锁定边界与验证

依赖完整固定在独立的 [uv.lock](../../runtime/comfyui/uv.lock)。Torch、torchvision、torchaudio 采用 CUDA 13.0 Windows CPython 3.12 wheel，与锁定 ComfyUI 的推荐一致；本机驱动兼容性仍由实际 CUDA 运算验证。PyPI 使用显式官方索引，避免镜像缺包改变解析结果。`torchaudio` 是 SheetSage2 对非 24 kHz 输入重采样的前提。

Doctor 分别检查 NVIDIA 元数据、实际 BF16 CUDA 矩阵运算、目标设备、Python/Torch/CUDA、干净代码提交、ComfyUI 原生节点加载、lazy YuE2/VAE/tokenizer/SheetSage2 import、48→24 kHz 重采样、全文件模型 SHA256、磁盘和本地端口。它不加载完整权重或证明音乐质量。YuE2 BF16 checkpoint 包含标准 VAE 和 tokenizer，无需另下 VAE 或 `qwen.tiktoken`；`vae=legacy` 不在此准备路径内。

无 GPU 的公开 CLI 行为检查：

```powershell
uv run --no-project --python 3.12.13 python -m unittest discover -s runtime/comfyui/tests -v
```

测试使用临时文件和临时外部 Runtime；这是 fake 逻辑证据，不能解锁 P0。实际环境结果和剩余限制记录在 [实施验证记录](../verification/runtime-doctor.md)。
