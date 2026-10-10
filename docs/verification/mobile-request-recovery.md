# 持久请求与未知提交恢复验证

日期：2026-10-10。来源：[SPEC-017 #99](https://github.com/CaiZongyuan/llm-music/issues/99)、[M2 #101](https://github.com/CaiZongyuan/llm-music/issues/101)。实施基线为已交付 M1 `5026b623`；Root 消费者与指南提交 `a3d190e`，后端冻结提交 `484135c`。本记录覆盖真实 HTTP 请求身份、事务与恢复，不代替手机存储、原生音频、APK、真机或 GPU 验收。正式独立审阅、最后 head 的 CI 与合并状态由 PM 在工单/PR 中登记。

## 行为与事务边界

Project 新建、Generate 与明确 retry 通过 `Idempotency-Key: UUID` 关联一个持久请求。真实 LAN 缺 key 或无效 UUID 返回 422；旧 loopback 消费者可以省略。首次成功保持 Project 201 / Job 202；同 key、同标准化意图返回 200 与原资源的当前状态。同 key、不同操作、有效目标或输入返回 409，优先于目标 404、当前 Runtime readiness 和原 retry 的动态验证。相同输入与不同 key 仍可产生独立资源。

`GET /requests/{request_id}` 返回已提交的平面引用：`request_id`、`operation`、`project_id`、`resource_type`、`resource_id`、`source_job_id` 与 UTC `created_at`。该时间为请求记录创建时间，不冒称提交完成时间。404 只表示本次读取尚未看到已提交记录；原请求可能仍在途。手机应保留原 key、server、目标和冻结输入，先精确查询，只有用户明确操作才重发同一意图。不得按 seed/相似输入或列表猜测原请求，也不得自动换新 key。

迁移 `0010_client_requests` 用服务器/单用户范围的唯一 request key 保留操作、目标、标准化输入摘要及 FK 资源引用。设备 UUID/token 轮换不改变其归属；新授权设备可以恢复旧 pending key，已撤销凭据仍先由 M1 拒绝。输入摘要基于已验证值、操作及目标，不包含凭据、当前 readiness 或可变 registry 时间戳。

Project 或 Job 与请求记录在同一数据库事务提交。写事务先取得 SQLite writer，再检查持久 key；Job 只由创建它的请求交给既有唯一 worker。重复请求没有 enqueue。Runtime preflight 在短写事务之外；其前后以及取得 writer 后的持久记录核对处理并发，已有请求不因 Runtime 后来不可用而被拒绝。

提交确认丢失时返回 503 `request_commit_unconfirmed`，`resource_id` 是精确请求 key。唯一创建者把自己新分配的 Job UUID 交给既有 worker，worker 的 `_begin` 在 prepare/dispatch 前鲜读已提交数据库：不存在或终态的行不执行 Runtime。这样一次 receipt 读回故障不会把已提交 Job 永远留在队列外，也没有增加第二个 scheduler 或让 stored replay 再提交推理。实际进程在 commit 后、handoff 前崩溃时仍保留既有有界原任务恢复政策，不自动重新推理或创建替代 Job。

取消沿原 Job 核对终态；不确定或运行中的 Job 不能提前 retry。已接受的 retry 保留原输入与 `retry_of_job_id`，后续同 key 恢复该 successor。Version 继续使用 Candidate/name/parent 的既有幂等与冲突，不增加保存键。

## 真实验证

全部后端用独立锁定 API uv 环境、Windows、临时数据库/文件、随机端口及 CPU 模拟 Runtime。真实双入口明确使用 WLAN `192.168.31.209`，没有使用生产数据、GPU、共享 Metro 或模拟器。

两类 producer 证据分别记录：readiness/retry 使用既有 ComfyUI HTTP adapter 与独立的 native-shaped CPU peer，其公开 `/fixture/state` 记录原尝试；数据库故障组使用进程内 Fake Runtime 与独立 HTTP CPU producer，避免无关的 native Git/model preflight，仍从外部公开 HTTP 计数观察真实 worker dispatch。该组 ContextVar 将故障限制在指定请求的系统数据库 commit/readback 边界，不 mock 业务 helper 或私有队列。

九项新增公开行为用例覆盖并发 Project、并发 Generate/readiness 变化、原子 commit 前后故障、在途 404 与明确同 key 重放、Job ACK 丢失、LAN key 与新设备恢复、retry 安全及重放、lost-handoff 窄反例、真正 commit 后崩溃/重启。测试断言使用 HTTP 列表、精确 request/resource GET 与外部 accepted 计数，没有查询私有 receipt 表来断言结果。

- 首个 Project tracer 在未实现时并发返回两个 201；实现后 201/200 共享一个资源和精确记录，标准化重放成功，不同输入 409。
- Generate tracer 原先并发产生两个 202；实现后 202/200 返回一个 Job、外部 peer 一次 accepted。完成后撤去模拟 owner/model 就绪证据，原请求仍 200，新的 key 503，同 key 换有效 Project UUID 则先 409。
- 提交前故障可见资源与 request 均不存在，accepted 为 0；实际 commit 已完成而 ACK 丢失时，两者都存在，同 key 返回原 UUID，原 Job 只执行一次。
- 指定提交在途时精确查询 404、资源列表仍为空；释放数据库 gate 后原调用与明确同 key 调用只创建一个资源。
- reviewer 的 lost-handoff 反例真实失败：ACK 丢失后仅首次 receipt SELECT 失败，原 Job 永久 queued，另一 key 的任务完成，外部 accepted 仅 1（14.77 秒）。删除创建者对同步 receipt 读回的依赖后，两项故障检查通过（18.95 秒），原任务与后续任务各执行一次。修复后不再执行这次无必要的 SELECT，故其故障 gate 自然不触发；没有为了触发 gate 恢复多余读。原失败 provider marker/log 保留在临时隔离证据目录。
- commit 后立刻结束真正进程（退出码 77），重启后仍可读取原 key/Job；其既有有界恢复得到原失败状态，重放没有推理，accepted 仍 0。用户以不同 key 明确发起相同输入，得到独立 Job 并完成（12.22 秒）。
- 撤销设备 A 后它查询 401；设备 B 使用新 UUID/token，可查询和重放相同 server 上 A 保留的 key。旧本地 keyless 请求仍成功。

最终本地受影响集合 **147 通过，124 条既有 warning，204.20 秒**，包含九项新请求检查、M1 LAN/配对、HTTP/WS 契约、Project/Asset、生成/取消/retry、Score/Cover、转谱与实际进程生命周期。严格 mypy 按项目配置 **65 source 文件通过**。原 M1 全部本地与最终 CI 的 245 项基线证据可复用；完整 API 的最后候选 CI 由 PM 观察并登记。

```powershell
uv run --project services/api --no-sync pytest services/api/tests/test_request_recovery.py -q
uv run --project services/api --no-sync mypy --config-file services/api/pyproject.toml services/api/src/music_api
```

本次受影响集合的确切文件、输出与 JUnit 在候选 worktree `.scratch/m2/affected-api.{log,xml}`。临时线程堆栈曾定位到 native fixture 的 Git 来源核查，故障当时尚未到达 commit；DB 故障组改用上述明确的 Fake Runtime producer 边界后获得稳定 oracle，临时 instrumentation 已移除。这个验证环境问题不算产品缺陷。

Root 同候选实际消费者结果：两次 CPU export 与生成 schema/严格 TypeScript 检查通过；Node 七项真实 HTTP/FormData/WS 检查通过（23 秒），包含 lost-response/restart 与 bodyless keyed retry；Web 类型检查通过。真实 Chromium 七项既有用户流程通过（约 1.1 分钟），loopback keyless 保持。文档十五项来源/章节/语言检查通过，Astro 十九文件零错误，构建六十六页并核对 5,219 个引用；agent-browser 实际核对中英文 `/request-recovery` 章节、锚点和语言切换。截图为 `.scratch/m2/docs-request-{zh,en}.png`。验证设置中的错误 project 名与拼写已纠正，不计为产品缺陷。

有限复杂度检查覆盖已更改的 transaction、matching、Job owner、Header 和生成消费者；把成功及不确定 ACK 的唯一 creator handoff 合并为一个位置，保留 replay、DB guard 与既有 startup 的不同责任。未新增设备 ACL、自动推理重提交、调度器或手机业务模拟。源代码、测试、生成客户端、配对/生成/恢复双语指南同票交付。
