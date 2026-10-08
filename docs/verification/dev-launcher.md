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

## 独立审查后的环境来源修复

- 原冻结 `867ad1d75b416996ab878cc0d9cf58dfd320d7f7` 保留。独立 Standards 发现新 uv 探测进程的 `sys.prefix` 加 listener 共同基础 Python 不能证明后者环境；两个真实 CPU uv 环境确实共有基础解释器。
- 复用现在要求 listener 的实际启动解释器路径，或 Windows 仍存活的直接 venv redirector。来源须对应同一命令、PID/创建时间与直接父子关系；当前项目锁与已安装环境只用 `uv sync --frozen --check` 验证，不修改它们。未证明或错误环境明确拒绝。该检查不声称读取进程内实时 `sys.prefix`，也不重写模型 receipt 时间。
- 公开 CPU 来源 oracle 使用同一个标准库 HTTP peer，在两个独立 uv 环境运行。比较实际进程基础 executable 相同，但原始 `sys.prefix` 不同；正确启动来源通过，错误环境被拒绝，两个外部服务在检查后都保持可读取。完整 collector 的模型/source 事实继续复用原有 API 证据；此 oracle 只证明新增环境来源边界。
- 第一次来源正例被拒绝：Windows redirector 的 `cwd` 读数可能与实际 child 不同。来源证明仅依赖精确解释器/命令/父子身份；实际 Runtime 源路径仍由 collector 校验。原失败 JUnit 为 `origin-repair-tests.xml`、`origin-debug-tests.xml`。
- 回归读取会话时还暴露 Windows 短暂文件 sharing 使原子替换失败；`write_json` 现在对这种占用有两秒上限的重试，CLI 输出统一 UTF8。原失败保留在 `origin-repair-final.xml`。
- 对真实 PID50752 仅执行公开来源检查，得到直接 creator38748、Runtime 项目14环境以及当前 lock `a2d73a2672b098f1cc6dd1160d6f760a9b31b49652f0e1a541e74946bd044225`。证据为 `.scratch/p2-development/37-launcher/protected-origin-readonly.json`；没有 Runtime HTTP、模型读取、CUDA import、启动或停止。
- 修复后的最终完整 CPU 检查 8 通过，43.14 秒，JUnit `origin-full-final.xml`。同配置复用正常停止保留原服务；来源正例与错误环境拒绝的两个 peer 在检查后仍可读，测试最终只清理自有进程并读回端口无监听。CLI help、Python 编译、Node 语法及 `git diff --check` 通过。
- 有界简化保留单一 `interpreter_origin` 来源边界，由完整启动和只读 CLI 共用；移除新探测进程共同基础 executable 的错误推断，没有扩展 Runtime HTTP/API 合同。实际三服务验收与双轴独立刷新仍由 Root 完成。

## 独立 Spec 审查后的原生重复启动修复

- 保留原始 `867` 和环境来源修复 `42ebc90`。独立 Spec 对 Root 登记候选 `827b1fd` 证明：API identity 在 native 自动 receipt 产生前比较 `None`，但首次 API 登记的是会话 receipt 路径；相同启动或例子的新 GUID 路径会误拒绝匹配 API。
- API identity 现在使用稳定 managed receipt 路径和明确的 Runtime 项目/上游/模型/状态目录配置。输入路径保留为来源，验证前先做不可变会话快照；现有 API 还必须匹配实际 native 进程/创建时间/命令与环境 lock binding。全部占用服务匹配后才发布验证过的原始 receipt 内容，不生成新的校验时间。
- `test_native_reuse.py` 仅替换 Native worker/Doctor/model-evidence seam，实际执行生产 `Launcher.run`、配置签名、进程身份、HTTP 健康与复用/停止逻辑。三个独立标准库 HTTP peer 明确为 CPU 编排 fixture，不是完整 FastAPI 或真实 native/model/GPU 就绪证据。
- 最小公开编排检查通过（0.91 秒）：自动 receipt 首次启动，换文件名的新鲜 receipt 第二次启动复用同一组 PID；当前 proof 可无路径再次复用；真实输入时间不改写旧 receipt；过期/不同 native proof 或不同应用数据被拒绝，active proof 不变，原 peer 全部仍可读取，最终只清理测试 owner 的 peer 并读回端口无监听。
- 完整适用 CPU 检查 9 通过，44.21 秒：8 项实际 CLI/HTTP + 1 项受控 CPU Native 编排 seam。JUnit `.scratch/p2-development/37-launcher/native-reuse-full-final.xml`；CLI/Python/Node 语法与 diff 检查通过。原 reviewer 的 `native-reuse-source-proof.json` 保留为修复前反例。
- 有界简化将输入来源与稳定服务配置分开，复用同一 owner/config 检查和原始 receipt 校验，不新增 Runtime HTTP/API。修复 freeze 与独立复审由 Root 继续；真实三服务启动/复用/停止仍独立待验收。

## 目标机器 LF/CRLF 兼容性修复

- Root 实际原生目标首次启动在 pyproject 比较处拒绝，未启动任何子服务（0 owned/0 forced），PID50752 保留。原始事实是 Root `.scratch/p2-development/37-real/launcher/sessions/61413e729e8e40b9839e439e39154ed2/session.json`，没有把失败重写为通过。
- 四份 Runtime 登记配置都是相同 Git 内容的 LF/CRLF checkout 差异。比较现在共用 `check_runtime_project_files`，只归一化 CRLF/LF；不修改环境或文件，也不改变实际 lock 字节 hash 的 origin provenance、locked sync、模型和源码绑定。
- 最小公开比较 oracle 对 LF 与 CRLF 均接受，同时拒绝实际 Torch dependency/lock、Runtime port 和 Model Registry schema 值改变；比较前后文件原始字节不变。作者只读比较实际项目14已通过，没有 Runtime/GPU/模型读取或服务操作。最终比较 JUnit 与冻结记录随交接保留；原9项 CLI/编排证据未受此文本比较边界以外的行为改变。
