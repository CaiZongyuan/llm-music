# #96 Acid Hardware Web 验收

日期：2026-10-10。起点：`1ce3268577c4fc25f533b5f01993b608bf5cf267`；本地分支：`issue-96-acid-hardware`，验收针对未提交工作副本。来源为 [SPEC-014 #96](https://github.com/CaiZongyuan/llm-music/issues/96) 与 [既有方向确认](../ui/ui-direction.md)。

## 实现边界

正式 Web 固定使用黑色 Acid Hardware。颜色、字体栈、3px 圆角、2px focus 统一在 `apps/web/src/styles.css` 根 token 层；feature CSS 只引用该层，旧别名全部移除。主题状态、切换入口、持久化与相关双语词条移除；语言偏好仍在原 HTML 启动脚本和 Preferences 模块中应用。abcjs 的前景/选择色与 WaveSurfer 的已播/未播/光标/片段颜色使用相同 token。

应用路由、请求、创作输入、Candidate→Version 保存语义、错误模型与单播放器继续沿用已有实现。新增运行/准备状态 class 和 data 属性仅承载视觉样式。正文、排队/运行/取消/失败标签和控件仍保留既有可访问语义。

规格引用的旧 `ui-acid-v1` 原型源文件不在当前工作区或可用 Git 历史中。因此，本次对照的是规格内明确列出的 token、控件、排版与状态要求，未声称旧原型逐像素一致。保留的 [可运行预览](../previews/acid-hardware/README.md) 使用正式组件与现有隔离 CPU Fake API。并行会话的 mobile、workspace/lock 变更不属于本次交付范围。

## 实际检查

| 入口 | 结果 |
| --- | --- |
| `pnpm web:check` | 3 项 Node token 契约通过；Vite 构建与严格 TypeScript 通过 |
| `pnpm test:browser:check` | 浏览器测试 TypeScript 通过 |
| token 负例探针 | 将同一契约测试复制到隔离目录，加入 `color:var(--text, red)`；实际扫描器拒绝此字面 fallback，退出码 1 |
| `pnpm docs:check` | 15 项检查通过；Astro 0 errors / 0 warnings |
| `pnpm docs:build` | 62 注册双语页面、66 HTML、4981 引用检查通过；既有缺 404 内容提示保留 |
| `git diff --check`（本次范围） | 通过 |

E2E 使用现有全部 Web 配置、生产构建、真实 Chromium、正式 FastAPI 与自有 CPU Fake Runtime；每套独立端口、数据库、素材和进程。保留所有原行为断言；原主题矩阵保留各用例，改为确认旧 `music.theme.v1=light/dark` 都不能覆盖恒黑界面，并保留中英切换、输入、原文件、身份与播放断言。最初失败 trace 和最终报告分别保留在 `.scratch/acid-e2e/`、`.scratch/acid-final-e2e/`；每套 `.artifacts/web-<uuid>/` 保留 API/Web 关闭回执。

最终全部 11 套 Web 配置通过，共 131 次用例执行（基础 Web 与 generation 配置包含重叠用例，不表示 131 个独立场景）：

| 根目录入口 | 通过用例 |
| --- | ---: |
| `pnpm test:web` | 20 |
| `pnpm test:web:jobs` | 14 |
| `pnpm test:web:transcription` | 1 |
| `pnpm test:web:generation` | 7 |
| `pnpm test:web:runtime` | 4 |
| `pnpm test:web:score` | 12 |
| `pnpm test:web:score-generation` | 16 |
| `pnpm test:web:cover` | 31 |
| `pnpm test:web:version-branches` | 8 |
| `pnpm test:web:version-compare` | 17 |
| `pnpm test:web:gate` | 1 |

实际调用复用这些入口的 Playwright 配置，增加 `--output` 并设置 `PLAYWRIGHT_HTML_OUTPUT_DIR`，为每套保留独立报告。版本分支最终完整结果为 `version-branches-confirmed.log`；其余结果为各配置同名 `.log`。Token 检查由 `web:check` 接入现有 CI。

## 真实浏览器视觉检查

实际 agent-browser Chromium 会话连接隔离预览 `http://127.0.0.1:59609`，数据目录为 `tests/browser/.artifacts/acid-preview-e85e7310-2c93-4a4a-b547-179f083cc1c5/`。该地址只在本次启动期间有效；重新运行预览会打印新地址。

| 状态 | 实测结果 |
| --- | --- |
| Library 空态与项目新建 | 黑底、方形面板、语言入口；无主题按钮；中文名称与笔记原样保存到隔离 Project |
| 字体与颜色 | 页面底实际 `rgb(5,5,5)`，色彩模式 `dark`；中文面板标签使用黑体回退，英文标签等宽大写 |
| 键盘 focus | 实际 Tab 后读回 `rgb(225,246,7) solid 2px` |
| 运行与减少动态效果 | 自有 hold 任务的指示灯动画为 `pulse`；切换系统 reduced-motion 后读回 `none`；请求取消仍执行原流程 |
| 保存失败 | 自有持久化故障标记触发原 `version_commit_unconfirmed`，红色错误面板保留名字与原意图，提供重新读取/同一版本重试 |
| 乐谱与播放 | ABC 图中 8 个 note；SVG 前景实际 `rgb(238,255,240)`；音频播放到 28.5 秒后进入 Score，仍只有 1 个原生 audio；波形已播部分酸绿 |
| 窄屏英文设置 | `innerWidth=390`、`scrollWidth=390`；标题和长按钮正常换行；语言为 `en`，外观仍 `dark` |
| 正常路径脚本错误 | agent-browser `errors` 为空；故障场景的预期 HTTP 失败独立于正常路径记录 |

截图保存在 [Library](../previews/acid-hardware/screenshots/library.png)、[运行态](../previews/acid-hardware/screenshots/running.png)、[保存失败](../previews/acid-hardware/screenshots/save-failure.png)、[乐谱与 Player](../previews/acid-hardware/screenshots/score-and-player.png)、[390px 设置](../previews/acid-hardware/screenshots/settings-390.png)。均为生产组件 + CPU 合成音频/隔离记录，不是 GPU 音乐质量证据。

WCAG 对比度按实际 token 的 sRGB 相对亮度计算：正文/页面底 19.60:1；次级文字/页面底 5.63:1、面板 5.26:1、次级面板 5.00:1；选中背景上的黑字 16.87:1；红色错误/面板 5.78:1，琥珀/面板 10.97:1。禁用色 `--faint` 只用于禁用控件。

## 修正与审查

真实浏览器发现中文等宽回退为宋体、首页品牌误用通用激活底色、禁用 Player 仍显示绿色，均已修正。Runtime 失败检查测得英文设置页 390px 时溢出到 415px；允许长标题/按钮文字换行后，原断言通过，完整 Runtime 套件通过。

版本分支第一次完整执行有 7 个通过、1 个保存回执恢复用例失败。第二次保存时，旧错误提示仍可被立即匹配，测试在请求返回前读到了 3 个版本；trace 中第二次 POST 持续 27.806ms。为该 Project 的第二次 POST 注册并等待 `waitForResponse` 后，原来的 4 版本、冻结名称/输入/父版本、两次相同请求体与无重复保存断言全部保留，完整 8 用例通过。没有因此改变产品保存逻辑。

独立规范审查发现命名颜色 fallback 被扫描器跳过，以及启动中停止预览可能丢失停止标记。修正后负例被拒绝；启动后 10ms 停止的 API 产生 `graceful:true` 回执、Node 退出 0；完整启动后停止也产生 API 与 Web 两份 `graceful:true` 回执、Node 退出 0。启动器停止超时时只处理自有 child 的进程树，并报告不平稳关闭。

独立规格审查发现两处中文指南仍提及主题切换，已与英文指南同步。最终规范与规格审查均无剩余可执行源码问题。变化去除了 Theme 类型/状态、setTheme、播放器主题更新 effect 及旧 token 别名；保留语言、Query 和播放器资源所有权，未新增依赖或通用抽象。

后端、GPU、ComfyUI、API 契约与模型均未因本次视觉任务改动或重新验收；本记录不代表部署、PR 合并或来源规格关闭。
