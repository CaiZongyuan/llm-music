# #37 开发启动器验证

- 开发基线：`71e47211b0417463011adf9b4d80e21ab9da1798`。
- 公开入口：Root 登记 `pnpm dev` → `uv run --project services/api --frozen python scripts/dev.py`；直接入口已执行。
- CPU 检查：`uv run --project services/api --frozen --no-sync python -m pytest tests/launcher -q`。
- 首次手动启动：API `18045`、Web `18046`，Runtime 参数 `18047` 为未启动的 Fake 隔离端口；运行记录位于 `.scratch/p2-development/37-launcher/manual/launcher/sessions/0935861fddb1404da17acc1b1ad923ad/session.json`。
- API、Web 正常停止确认已读取；会话最终 `stopped`、`forced_processes=[]`。Fake 使用 API-local CPU fixture，不是模型推理证据。
- 首轮测试 6 通过、1 失败。失败为复用测试读取前一会话的 `ready` 文件；测试改为只接受本次新会话。失败记录与 owned 停止记录保留；不删除原始事实。
- 第二轮测试 6 通过、1 失败：原生拒绝场景的测试 HTTP fixture 停止后，立即取样仍看到 listener。测试清理现在记录子进程创建时间，并在三秒有界窗口读取停止后状态。原始失败 JUnit 保留在 `.scratch/p2-development/37-launcher/tests-final.xml`。
- 最终冻结 CPU 检查 7 通过，43.75 秒；JUnit `.scratch/p2-development/37-launcher/tests-freeze.xml`。覆盖干净启动/HTTP/Project 身份/重启后读取、配置匹配复用、复用会话退出保留原服务、配置不匹配、外来端口、单服务启动失败、未准备原生环境及无效原生 owner/model receipt 拒绝。
- `uv sync --project services/api --frozen --check` 通过（41 个包、无修改）；CLI help、Python 编译、Node 语法及 `git diff --check` 通过。
- 有界 reduce-complexity 检查覆盖本票全部新源、测试和实际启动消费者。保留进程身份、worker 停止、API-local Fake 与原生 Runtime 边界；没有发现值得扩大本票范围的简化。生产 API、依赖锁与已关闭预览未修改。
- 真实 GPU/目标机器三个服务启动、原生 Runtime 复用和停止由 Root 独立验收；此候选不将 Fake 结果视为真实 Runtime 通过。

Root 集成登记项：根 `dev`、`test:launcher`，显式 CPU CI 执行，`docs/site.json` 成对登记 `guide-dev-launcher`（`guides/dev-launcher`）。作者不修改共享根包、CI 或站点清单。
