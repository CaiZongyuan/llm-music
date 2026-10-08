# 把参考音频留在一个音乐项目中

在正式 Web 中创建项目、写下创作方向，再加入原始 WAV。项目和素材由应用服务保存。刷新页面后，仍能打开同一个项目，读取同一个原文件。

## 开始一个项目 {#create}

1. 打开已启动的 Web，进入“我的项目”。
2. 在“项目名称”输入“雨后的散步”。在“创作笔记”记录想探索的情绪或乐器，例如“保留轻快旋律，试试温暖的钢琴”。
3. 选择“创建并开始创作”。页面进入这个项目的工作区；项目也出现在左侧导航。

已有项目可以从列表重新打开。用户输入的名称与笔记不会因界面语言改变。

## 加入并检查参考音频 {#audio}

1. 在工作区选择一个本地 PCM WAV，再选择“加入项目素材”。仅选择文件还没有保存。
2. 在“项目素材”选择保存后的文件。详情显示文件名、类型、时长、声道、采样率、素材标识和原文件 SHA256。
3. 选择“下载原文件”，确认仍能取得原始音频。刷新或回到“我的项目”再打开它，原素材及标识保持相同。

当前转谱的已验证输入是16秒 PCM16，单声道24 kHz或立体声48 kHz。上传预算为64 MiB/600秒；这不是更长音频的推理承诺。上传后进入[参考转谱](web-transcribe.md)，检查谱面并下载 ABC/MIDI。也可以进入[音乐生成](web-generation.md)，从风格与歌词得到 Candidate，试听后明确保存为 Version。底部的持续播放器在工作区导航时保留当前音频。

要比较作品，在“版本”选择同一项目的两份已保存 Version，使用底部 A/B 按钮与共同试听片段。打开乐谱或歌词时音乐继续；[比较指南](web-generation.md#compare)说明绝对秒数、较短结尾与失败恢复。同一项目刷新可恢复有效的 A/B 选择，从0秒暂停，不保留位置或片段。

## 选择语言与主题 {#preferences}

顶部语言控件提供中文和 English。亮暗模式按钮切换整套工作区颜色；语言与主题在导航、刷新后保留。切换时，正在输入的笔记、已选择的文件与项目身份保持不变。浏览器禁止本地存储时，仍可在当前页面切换；刷新可能恢复默认偏好。

## 失败后继续 {#recover}

无效或不完整的 WAV 会被应用服务拒绝，不会变成项目素材。保留原项目，改选有效文件后再提交。读取失败时选择“重新读取”；文件内容和素材记录的读取失败会显示为错误，而非空项目。

保存确认失败或连接中断时，不要马上重复创建或上传。先重新读取项目/素材，检查已保存记录；错误中的素材标识可以帮助确认原操作。页面不会自动重试写入。找不到项目或页面时，可返回“我的项目”重新选择。

项目“任务”和全局“任务”读取同一批已保存的生成/转谱 Job，显示五种状态、阶段和明确的重新读取动作。未知进度不显示百分比。[任务指南](web-jobs.md)说明取消确认、显式重试与断线恢复。

## 本地启动与隔离验证 {#launch}

需要 Node24、仓库指定的 pnpm、uv/Python3.12，以及独立应用环境。从仓库根目录准备：

```powershell
pnpm install --frozen-lockfile
uv sync --project services/api --locked --python 3.12.13
```

在第一个终端启动独立 CPU FakeRuntime API（确认端口空闲，数据仅写这个专用目录）：

```powershell
$env:MUSIC_API_RUNTIME_MODE='fake'
uv run --project services/api --no-sync music-api serve --host 127.0.0.1 --port 18036 --data-dir tests/browser/.artifacts/manual-web/application
```

在第二个终端启动 Web：

```powershell
$env:MUSIC_WEB_API_TARGET='http://127.0.0.1:18036'
pnpm web:dev --port 18035
```

打开 <http://127.0.0.1:18035/>。Web 的 `/api` 代理连接 FastAPI；它不连接 ComfyUI。FakeRuntime 结果仅供应用交互检查，没有真实音乐推理。退出时分别在自己启动的两个终端按 Ctrl+C；不要停止其他项目或共享 Runtime 的进程。也可以按[一条命令启动指南](dev-launcher.md)使用 `pnpm dev`；真实模式编排独立 Runtime、API 与 Web，并保留已复用服务。

```powershell
pnpm web:check
pnpm test:browser:install
pnpm test:browser:check
pnpm test:web
pnpm test:web:jobs
pnpm test:web:transcription
pnpm test:web:generation -- generation-recovery.controlled.ts
```

`web:check` 构建生成客户端、生成文件路由、构建正式 Web 并检查严格类型。产品浏览器测试启动自有 Fake API 和 Web，保留失败 trace、截图及 `.artifacts/<run-id>/` 的进程/数据记录，退出须收到平稳关闭确认。它与既有 Swagger 测试使用不同入口；没有录屏。真实 GPU 推理证据另行验收。维护约定见 [Web 源码说明](../../apps/web/README.md)。
