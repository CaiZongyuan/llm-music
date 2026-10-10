# 移动端首版实施安排草案

日期：2026-10-10。用户已确认完整隔离交互预览并授权接入真实后端。正式规格 [SPEC-017 #99](https://github.com/CaiZongyuan/llm-music/issues/99) 和六张实施票据已发布；GitHub Issues 是范围、阻塞和完成状态的来源，本文件保留实施边界与安排。

## 交付行为

保留 Web 与同一 FastAPI 数据拥有者。手机通过局域网手工配对连接保持运行的音乐电脑，创建/打开 Project，输入风格、歌词、Seed 与时长上限，发起和恢复 Job，取消并明确重试，试听 Candidate，再命名保存 Version 与查看历史。手机保留创作草稿和未确认请求，返回时先读原任务。使用 Expo SDK 57，日常优先 Expo Go，Android 模拟器、真机与独立 APK 作为正式验收目标。

最新已交付的时长契约来自 [#97](https://github.com/CaiZongyuan/llm-music/issues/97)：空/0 自动，UI 手工上限 5–360 秒；输出可早于上限。阶段来源沿用已存在的 API，真实进度未知时不显示百分比。iPhone 的初始化连接反馈不自动扩大正式首版验收范围。

## 预览与准入

[mobile-workbench-v1](../previews/mobile-workbench-v1/README.md) 是 Expo Go / 网页共享的可运行预览，源代码与模拟数据保留于 `docs/previews/`。所有配对、项目、任务和版本操作仅写内存；试听复用已有来源明确的历史 MP3，不运行 GPU、不读取真实数据库或设备凭据。黑色 Acid Hardware 与“声间”品牌沿用最新确认。

Root 对确认版本执行了真实浏览器与 Android Maestro 检查，并取得非作者 Standards/Spec 审阅。用户回复“确认”，见 [UI 记录](../ui/mobile-workbench-preview.md)，正式业务实施已经准入。预览的模拟成功不能替代正式数据、权限、原始 FLAC、进程恢复或 APK 验收。

## 已发布规格与实施票据

父规格 **[SPEC-017 #99：移动端便携音乐工作台](https://github.com/CaiZongyuan/llm-music/issues/99)**，按 [追踪器规则](../agents/issue-tracker.md) 已建立原生 sub-issue 和 blocked-by 关系。M1–M6 仍作为边界别名，实际票据如下。

| 草案票据 | 交付范围 | 实际阻塞与验收 |
| --- | --- | --- |
| [M1 #100](https://github.com/CaiZongyuan/llm-music/issues/100)：局域网接入与可撤销配对 | 同一 API 生命周期双监听；短码、设备凭据摘要、授权/撤销、HTTP/WS/Asset 权限及本地管理边界 | 已确认预览；隔离 DB/真实 socket 验证，保留 loopback Web/CLI 契约和单一 Job worker。 |
| [M2 #101](https://github.com/CaiZongyuan/llm-music/issues/101)：未知写入的幂等恢复 | Project/Generate/retry 的持久请求 key 与精确查询；同事务创建、冲突与并发；Version 沿用 candidate 幂等 | #100；响应丢失、原请求在途、进程重启、相同输入不同意图与同 key 不同输入。 |
| [M3 #102](https://github.com/CaiZongyuan/llm-music/issues/102)：移动端数据与连接 | SDK Go 兼容依赖，OpenAPI client、凭据/草稿/pending intent 持久化，前后台 HTTP 恢复及 WS | #100/#101；存储失败、切换电脑、撤销、网络恢复、不自动重发。 |
| [M4 #103](https://github.com/CaiZongyuan/llm-music/issues/103)：原生创作与版本闭环及电脑面板 | 已确认 UI、项目/输入/任务/取消重试、Candidate 明确保存、历史、电脑配对管理 | #102；正常/空/加载/失败、未知结果、草稿与快照、保存恢复和重复操作。 |
| [M5 #104](https://github.com/CaiZongyuan/llm-music/issues/104)：前台原始音频 | `expo/fetch` 显式 redirect:error 带 Authorization 下载原始 FLAC，校验后 `expo-audio` 播放本会话临时文件；播放/暂停/seek、中断/撤销与清缓存 | #100/#102；本地 seek 与 HTTP200/206/416/HEAD 分开取证。首轮 Go 原字节/decoder 已验证；当前完整生命周期、UI 拖动、物理设备与 APK 分别验收，不由 UI 动画代替。 |
| [M6 #105](https://github.com/CaiZongyuan/llm-music/issues/105)：正式交付验证 | Maestro 日常 Fake Runtime、Android 真机、独立 APK、真实 GPU 创作闭环及文档 | #103/#104；实际 producer/source/binary/namespace，root 集成后验收，不把预览或待合并结果计为完成。 |

每个实施票据有一个 owner/branch/worktree；数据库迁移、OpenAPI/生成 client、依赖锁与共享资源由 Root 协调集成。GPU 工作保留串行资源 owner，普通日常检查使用隔离 Fake Runtime。当前 Web 未提交工作由原 owner 保持，移动端不借机改写其范围。

## 接口与关键验证

详细真实消费者、socket 归属、凭据/短码、幂等请求、WebSocket、受控音频下载与验证边界见 [API 草案](mobile-api-plan-draft.md)。M5 不再向 `expo-audio` 交远程带 header source；后台保存位置后解除 SDK 注册并实际释放，前台复核后仍等待明确继续。独立 HTTP 范围与首轮 Go decoder 收据、当前候选的公开回归及尚未验收项见 [音频核验](../verification/mobile-audio.md)。实现优先复用既有 Project、JobService、Candidate 和 Version；不可建立第二个 scheduler/业务数据库或直连 ComfyUI。

业务实现完成后执行受影响 API/launcher/client/Web 检查、原生 Maestro、原始音频及 APK/真实 GPU 验收，并读回实际集成结果。预览及正式票据已交付；产品接口和二进制按上述依赖推进，未实现部分不记为通过。
