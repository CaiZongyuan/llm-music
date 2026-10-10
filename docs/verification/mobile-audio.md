# 移动端前台原始音频核验

日期：2026-10-10。规格：[SPEC-017/M5 #104](https://github.com/CaiZongyuan/llm-music/issues/104)。固定实现起点：`833168c4595f2c8ddf1531d3e2015602c94516b8`。本记录覆盖 `apps/mobile/src/media`、媒体回归及必要的 `expo-file-system` 依赖；M4 页面、Root 的 provider 注册和 M6 原生配置分别集成与验收。

## 传输与生命周期合同

原始受保护 FLAC 由 `expo/fetch` 带 Authorization header 下载，真实调用显式传入第二参数 `{ redirect: 'error' }`。缓存文件通过 size/SHA256、格式和音频 profile 校验后，`expo-audio` 才收到本地 `file://` URI。实现没有远程 fallback、MP3 替代或离线音乐库。

每次播放与 seek 复核 M3 授权；前台有活动本地文件时每五秒再次复核，即使 Job 已终态、WS 已关闭。后台、断连、撤销或 server/device/epoch 变化取消下载，保存实际位置，pause → remove SDK registration → release，再删除完整文件和残片。前台恢复等待明确播放，不自动下载或重放。启动只清本命名空间崩溃残留。删除失败报告错误并保留清理责任，后续 release 可重试。

本地 seek 不产生服务器 Range。HTTP 的 GET/HEAD/Range 与原始字节、原生的解码/位置，以及 UI 的拖动操作各自取证。

## 公开接口回归

媒体测试使用实际 M3 `createMobileSession`，只注入外部 HTTP、文件缓存、播放器和时间预算。原样本在 [fixture 记录](../../apps/mobile/tests/fixtures/README.md) 中，独立 SHA256 固定为 `2e36c3fd44bc2738d02a023c65461e58016b7dd33e1ed98b9fb15d350be27897`；测试直接比较下载/缓存字节，不使用私有业务函数替身。

24 项 controller 媒体测试通过。它们覆盖原字节校验、paused local source、播放/seek 授权和真实状态位置、body/decoder 共用超时、忽略 abort 的迟到 provider、部分下载后台取消、终态 Job 后撤销观察、12 秒位置恢复、迟到授权不能覆盖 pause、同 UUID 换电脑隔离、慢旧删除不能覆盖新选择、dispose 拒绝新动作、崩溃残留清理、pause 失败仍释放、完整/部分/迟到缓存删除失败后重试、结束后从零重听、重定向和篡改字节拒绝、异步解码失败后释放及明确恢复，以及审阅发现的原生清理失败责任和 suspend 期间换电脑恢复边界。

另有 3 项实际 native-player 适配源码的 Node 检查：通过模块 hook 仅替换外部 `expo-audio` SDK factory，分别注入 pause/remove/release 报错。各步骤尽力执行；成功的 remove/release 不重复，失败的 owning step 在后续 release 重试。模块 hook 在 import 后注销，临时全局 fixture 引用也删除，测试进程隔离。它们证明适配器针对外部 SDK model 的行为，不声称实际原生 SDK 出现了这些故障。

检查命令在此 worktree 根目录运行：

```powershell
pnpm --filter @llm-music/mobile test
pnpm --filter @llm-music/mobile check:test
pnpm mobile:check
pnpm --filter @llm-music/mobile exec expo install --check
pnpm docs:check
git diff --check
```

审阅修复后移动端全集 53 项测试、应用与测试 TypeScript 通过。SDK 依赖版本与 staged diff 检查通过。`docs:check` 已生成 62 个配对页面，15 项文档测试通过，Astro 19 个文件 0 error/warning/hint；本轮新增维护记录没有改变已注册公开正文、导航或依赖。首次文档检查因新 worktree 的 API 环境尚未同步而报 `No module named music_api`；执行该 worktree 的 `uv sync --project services/api --frozen` 后重跑通过，未修改锁文件或运行 API/GPU 服务。Node provider 故障证明公开接口的授权/取消/清理行为，不代表物理存储故障或原生音频解码。

审阅前 controller SHA256 为 `79101041ed57b9e4b81b73c1ac2921b17492403c7ba4c9ec8ca387e132497d8a`，旧清单 `.scratch/m5-media-candidate-hashes.json` 保留。当前修复候选 controller SHA256 为 `5b93e6dc12f592500976adf50938ff3cbec3edafbff51209e5446b9704b539bb`，native-player 为 `fb39093e1d48c361bc7ee6bfd9f152366ce12ab27ba2c37db3043e347bc705af`；完整代码/测试/依赖清单保留于该 worktree 的 `.scratch/m5-media-candidate-v2-hashes.json`。这属于完整原生验收前的候选，后续修复须刷新对应证据。

有限简化以本次未提交媒体文件和上述固定起点为范围：完整文件接管 writer 的清理责任，避免同时删除同一片段与文件；通用清理集合保留删除失败的完整文件、部分文件和迟到 writer。保留 M3 授权边界、原生适配器、时限与 revision 守卫，没有扩大 UI、配置或共享 API schema 的范围。独立 Standards/Spec 审阅及当前完整原生生命周期验证由 Root 排期。

## 独立审阅反例与修复

非作者通过真实 M3 session 和外部 provider 复现两项 P2。原 controller 在第一次 `Playback.release()` 抛错后丢失 handle，第二次 release 假报 idle，并能创建第二个 player；native adapter 也在操作前提前置 released，阻断失败步骤重试。现保留 handle/订阅清理责任，所有步骤分别尽力执行，只有 cleanup 确认成功后 replacement 才能创建。该反例先 red，修复后 green；同一 handle 的两次失败及成功重试得到检查，随后才创建新 player。

另一反例为 select A、seek 12 秒、suspend 取消订阅，再由真实 M3 配对电脑 B；两台电脑有相同 Project/Asset UUID。原 start 只监听未来事件，旧记录和 12 秒位置被解释成 B 的数据。现共用 `reconcileSession`，start 和明确 play 均立即读取当前 SID；跨电脑清 selection、position 和 duration，不等待下一 event。start 与直接 play 两种恢复路径均拒绝重放旧记录。

## 真实 Expo Go 首轮音频

Root 在隔离 Android Expo Go 上冻结首轮最小媒体源，验证了真实 FileSystem/Crypto 和音频 decoder。原 FLAC 为 467,960 字节；SHA256 与上面的独立 digest 一致；实际 decoder duration 为约 34.998–34.999 秒。ready 时 paused，明确播放后位置超过 1 秒；暂停后 seek 到 12.000 秒；release 后 idle 且 verified 清空。真实缓存数为 0 → 1 → 0。

Root 工作区证据为 `.scratch/mobile-implementation/m5-first-native-receipt.json`、`m5-first-media-hashes.json` 与归档的 `m5-native-verify-final.tsx`。临时验证路由已删除、Metro 已停止。这个首轮证明适配 API 可用；它先于本次扩展的完整生命周期、迟到清理和 decoder 异常回归，不自动证明当前候选的全部原生路径。

该样本由隔离 FastAPI CPU Fake Runtime 产生，内容是确定性 test tone。它不是 GPU 生成音乐或用户录音。

## 真实 LAN 原字节与 Range

Root 使用独立设备授权探针对同一原样本执行真实 HTTP；没有撤销原生当前活动设备。GET 200 的 SHA256 与原文件一致；HEAD 200 的 length 为 467960，无 body。`bytes=0-15` 与 suffix 16 返回 206，Content-Range 和原片段一致。`bytes=467960-` 返回 416，Content-Range 为 `bytes */467960`。撤销探针设备后，新的 GET、HEAD、Range 均返回 401，没有原 FLAC 字节或 FLAC MIME；错误响应可有 JSON body，不能描述为所有响应 body 都为空。

Root 工作区证据为 `.scratch/mobile-implementation/m5-lan-byte-receipt.json` 和 `m5-lan-byte-probe.py`。HTTP 范围证据与上面的本地 decoder seek 分开，不把本地 seek 说成远程 Range。

## 保留的重定向失败与修复证据

此前原生探针已证伪仅在 RN `new Request` 设置 redirect 的方案：默认 `expoFetch(request)` follow 后，目标累计收到 1 次旧 GET，Authorization 没有传到目标。随后改用显式 `expoFetch(request, { redirect: 'error' })`，目标新增请求为 0，历史累计仍为 1。生产 native adapter 采用相同调用方式。

相关 Root 收据为 `.scratch/mobile-implementation/m3-native-redirect-receipt.json`，详细经过见 [M3 原生重定向记录](mobile-client-core.md#原生重定向反例与修复)。保留失败事实，不把修复后的新增 0 写成历史累计 0。

## 尚未计为完成的证据

当前扩展后候选仍需 Root 对完整原生后台/前台、撤销后的新播放/seek、解码错误恢复和 M4 拖动目标执行实际验证。物理 Android、项目自身独立 APK 的录音/后台/网络配置及真实 GPU 创作闭环属于后续独立验收。Go 首轮、HTTP 探针及 Node 回归均不替代这些交付证据。
