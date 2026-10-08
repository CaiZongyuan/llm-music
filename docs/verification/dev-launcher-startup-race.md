# #37 启动器 fast-exit 后续修复

这是已交付 #37 在 #38 gate CI 暴露的后续故障记录，不替代原 #37 集成验收。基线为 `adfd190687f0b2c400e0645de6de438e2b9d5473`，独立分支 `p2/37-startup-race`。

- 原始失败：GitHub Actions run `37720127917`、#38 候选 `d5e53694e24ed296c9de190f31ae428be816ea0b`。原公开用例要求 `api startup failed`，实际为 `Launch refused: process PID not found (pid=8588)`；会话停止输出为 1 owned、0 forced。Root 保留 `.scratch/p2-development/38-ci-d5e-failure.log` 与失败 job 信息。
- 诊断：`Launcher.observe_children` 验证身份后，在异常保护外枚举 descendants。真实自有 uv/API child 在两步之间退出，可以抛出 `NoSuchProcess` 并盖过服务故障诊断。初次 `identity(child.pid)` 前退出也产生相同诊断丢失。
- 确定性反例：`test_startup_race.py` 使用实际 uv/API 子进程、隔离 application 文件和 loopback 端口，只在初次身份或 descendants 边界等待该 `Popen` 退出。基线 2 failed、3.02 秒；descendants 例重现原失败的 1 owned、0 forced。修复后 2 passed、3.00 秒。JUnit 保留在该 worktree 的 `.scratch/startup-race-{red,green}.xml`。
- 修复只在本次 `Popen` handle 确认已经退出时恢复原服务 startup failed 诊断。活着的 child 遇到相同 `NoSuchProcess` 继续拒绝；新增负例验证这一点。负例第一次使用了错误的 psutil 文本预期，实际已正确拒绝；该失败保留为 `.scratch/startup-race-safety.xml`，修正后结果为 `.scratch/startup-race-live-refusal.xml`。
- 原公开故障用例在独立 frozen 环境中通过（19.47 秒）。修复后完整公开 `pnpm test:launcher` 首次为 12 passed、59.99 秒，覆盖原 10 项及两个 fast-exit 反例。包含 live-child 负例的最终完整命令为 `pnpm test:launcher --junitxml=.scratch/startup-race-full.xml`。
- `uv sync --project services/api --frozen --check`、CLI help、受影响 Python 编译及 diff 检查通过。测试只启动 CPU Fake 自有进程；故障会话均失败并保留 traceback，读取确认隔离端口无监听，force 列表为空。

影响与有界简化：`start` 与 `cleanup` 是 descendants 观察的实际消费者。复用、native 环境来源、PID/创建时间/命令身份、owner handshake、会话 token 与 force 前重新匹配不变。局部 `check_child` 共用已有故障格式，避免两个死亡边界出现不同文案；没有扩大异常捕获到全局身份检查。未修改公共接口、依赖、页面、根包、CI 或生成客户端。

真实 native/GPU 不属于该死亡分支的新增验证；既有 #37 目标机器 receipt 由 Root 按语义范围复用。共享 Runtime PID50752 未读取、停止、写入或提交 GPU 任务。独立审查、最终 #38 集成与 hosted CI 由 Root 完成；本地检查不宣称最终 gate 已通过。
