# Acid Hardware — 正式组件隔离预览

来源：[已确认方向](../../ui/ui-direction.md)与 [#96 SPEC-014](https://github.com/CaiZongyuan/llm-music/issues/96)。工作区固定黑色，保留已确认的布局、文案和操作。规格引用的旧 `ui-acid-v1` 源码不在当前仓库或可用 Git 历史中；本预览使用正式 React 组件，按规格中的 token、排版、控件和状态要求验收，不宣称旧原型的逐像素对照。

## 启动与停止

在仓库根目录执行：

```powershell
pnpm install --frozen-lockfile
uv sync --project services/api --locked
pnpm --filter @llm-music/api-client build
node docs/previews/acid-hardware/serve.mjs
```

打开命令打印的本机地址。启动器为 FastAPI 与 Web 分别分配自有 loopback 端口，并打印唯一的 `tests/browser/.artifacts/acid-preview-<uuid>/` 目录。每次启动使用新 SQLite、素材目录和生产 Web 构建；CPU Fake Runtime 提供可播放的合成音频。新建 Project、生成、试听、seek、明确保存 Version、查看乐谱、编辑与 MIDI 试听均可执行。数据写入仅进入该次隔离目录，浏览器语言偏好仍由实际组件保存在本地。

按 Ctrl+C 停止两个自有服务。`stopped.json` 与 `web-stopped.json` 记录平稳关闭。启动过程中停止也会等目录出现后写入停止标记；25 秒内未退出则停止自有进程树并报告失败。该预览复用现有 CPU 浏览器测试设施，不连接 GPU/ComfyUI，也不使用正式数据目录。

## 空、加载与失败状态

新启动的 Library、项目素材、任务与版本均为空。以下控制文件只属于隔离预览，设置 `$previewRunDir` 为启动器打印的目录：

```powershell
$previewRunDir = 'D:/Projects/Backend/llm-music/tests/browser/.artifacts/acid-preview-<uuid>'
# 新任务保持运行；在页面请求取消以结束此任务。
Set-Content -LiteralPath "$previewRunDir/generation-control.json" -Encoding ASCII -Value '{"scenario":"hold"}'
# 下一次提交返回创作失败，页面保留输入并提供明确重试。
Set-Content -LiteralPath "$previewRunDir/generation-control.json" -Encoding ASCII -Value '{"scenario":"generation_failed"}'
# 重新检查准备状态后，缺模型会禁用提交。
Set-Content -LiteralPath "$previewRunDir/generation-control.json" -Encoding ASCII -Value '{"capability":"missing"}'
# 恢复；已开始任务的结果设定不变，新任务使用正常结果。
Set-Content -LiteralPath "$previewRunDir/generation-control.json" -Encoding ASCII -Value '{}'
# 下一次 Version 保存在提交前失败；只影响隔离数据库。
New-Item -ItemType File -Path "$previewRunDir/fail-version-save"
```

ABC 编辑器可输入无效乐谱以查看校验失败；浏览器断网可查看读取失败和输入保留。无法解码、资源加载失败、保存回执未知等状态由现有受控 E2E 覆盖，入口及实际结果见 [验收记录](../../verification/acid-hardware.md)。这些控制文件不是产品功能。

## 视觉契约

| Token | 值 |
| --- | --- |
| `--bg` | `#050505` |
| `--panel` / `--panel2` | `#101010` / `#161616` |
| `--line` / `--line2` | `#232923` / `#39413a` |
| `--text` / `--muted` / `--faint` | `#eefff0` / `#7d8a7d` / `#4a544b` |
| `--acc` / `--acc-ink` | `#e1f607` / `#050505` |
| `--err` / `--warn` | `#ff4d3d` / `#ffb800` |
| `--sans` / `--mono` / `--disp` | 系统中文黑体 / 等宽与中文黑体回退 / 宽体黑 900 |
| `--radius` / `--focus-width` | `3px` / `2px` |

全局 token 层是唯一样式来源。标签以等宽大写、字距区分，输入与歌词保留原样；只有运行中指示灯脉冲，尊重系统减少动态效果。主题入口和主题持久化已移除，语言与 A/B 选择的持久化继续保留。
