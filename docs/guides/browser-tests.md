# 运行浏览器集成测试

用真实 Chromium 操作现有 FastAPI Swagger `/docs`，验证 Project、输入错误、Generate、Candidate、Audio/Score 和明确保存 Version。当前测试覆盖 P1 API 文档这个浏览器消费者。正式音乐工作台 Web 在 P2 开发；本测试不代表真实 Web + ComfyUI 的端到端验收。

## 安装并运行

准备 Node `24.18.0`、pnpm `11.22.0` 和 uv `0.11.28`。在仓库根目录执行。首次安装需要网络来下载固定依赖、Python `3.12.13` 和 Chromium。

```powershell
pnpm install --frozen-lockfile
uv sync --project services/api --locked --python 3.12.13
pnpm test:browser:install
pnpm test:browser:check
pnpm test:browser
```

成功时终端显示 `1 passed`。测试通过 Swagger 的 `Try it out`、表单、`Execute` 和 `Download file` 执行实际 HTTP：创建并读取 Project，显示真实 `422 invalid_request`，生成 Candidate，核对 Score，下载 Audio 并核对 SHA256，检查 Version 列表为空，然后明确保存。第一次保存为 `201`；相同保存请求为 `200`，返回同一 Version。刷新页面后再读该 Version。

API 使用 `services/api` 自己的 uv 环境。测试为每次运行选择空闲 loopback 端口，并建立新的 `tests/browser/.artifacts/<RUN_ID>/application/` 数据目录。SQLite 和文件都是真实写入，但仅属于这次 CPU 测试。Runtime 被明确设置为 `fake`；音频是原始 CPU 测试音调。测试不连接 ComfyUI、不加载模型。Chromium 使用 `--disable-gpu`。

原有 `/docs` HTML 和 OpenAPI 不变。测试仅把 Swagger CDN 的 JS/CSS 请求用锁定的本地 `swagger-ui-dist` 文件响应，且取消外部 favicon 请求。业务 HTTP 全部访问真实 API。升级 FastAPI 或 Swagger 时，应重新验证页面操作和这些静态资源路径。

## 查看失败并恢复

失败时查看 `tests/browser/playwright-report/index.html`。Swagger 测试在 `tests/browser/test-results/` 保留失败截图和 trace；按用户反馈始终关闭视频，即使设置 `PLAYWRIGHT_RECORD_VIDEO=on`。GitHub Actions 的失败产物保留七天，不会生成或上传新的 Swagger 录屏。运行中与退出后的 API 事实保存在 `.artifacts/<RUN_ID>/owner.json`、`api.log` 和 `stopped.json`；`graceful: true` 表示服务完成应用关闭。

```powershell
pnpm --filter @llm-music/browser-tests exec playwright show-report
pnpm --filter @llm-music/browser-tests exec playwright show-trace test-results/<TEST_RESULT_DIR>/trace.zip
```

用失败目录的实际名称替换 `<TEST_RESULT_DIR>`。缺少 Chromium 时重跑 `pnpm test:browser:install`。缺少 API 依赖时重跑锁定的 `uv sync`。表单定位或断言失败时先查看 trace；每次重跑使用新的数据目录，保留原失败证据。端口占用时测试拒绝复用已有服务；不应停止别人的服务。

测试结束会请求自己的 API 平稳退出并等待确认。数据和日志保留，便于检查失败；不会自动删除。确认 `stopped.json` 后，可清理对应 `<RUN_ID>` 目录。截图、视频、数据库、Node modules 和 Python 环境不进入 Git。

## 交互调试与 trace

```powershell
pnpm test:browser:ui
```

此命令打开 Playwright 测试界面。需要保留一次成功操作的 trace（包含自动截图）时，运行：

```powershell
pnpm test:browser --trace on
```

trace 位于 `tests/browser/test-results/<TEST_RESULT_DIR>/trace.zip`。此前已交付的 Swagger 录屏只作为历史证据保留。通用 harness 的 `PLAYWRIGHT_RECORD_VIDEO=on` 选项仍供未来正式 Web 使用；重大可见流程可按需另做压缩 WebM，实际生成音乐的试听附件使用独立压缩副本。当前 Swagger 套件不录屏；音频测试下载不代表生成了真实音乐。

该仓库只使用根目录的一套 pnpm workspace 和锁文件。后续 TypeScript client 与 P2 Web 接入同一 workspace。P2 用户流程应补充真实产品页面测试，不能把 Swagger 测试改名作为产品 Web 验收。

完整、受版本控制的测试和运行源码：

<<< ../../tests/browser/playwright.config.ts

<<< ../../tests/browser/run_api.py

<<< ../../tests/browser/teardown.ts

<<< ../../tests/browser/swagger.ts

<<< ../../tests/browser/swagger.spec.ts

实际验证与限制见[维护记录](../verification/browser-tests.md)。在线文档站尚未交付；当前直接阅读仓库文档。
