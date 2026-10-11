# 声间 · 移动端工作台交互预览 v1

2026-10-10 用户已确认本版界面与流程，见 [确认记录](../../ui/mobile-workbench-preview.md)。本目录保留确认时的隔离预览，供正式实现对照。

这是已确认黑色 Acid Hardware 方向的小屏交互预览。预览源码仅在本目录维护，`apps/mobile/src/app/preview/` 是 Expo Router 的薄路由；不复制 Web DOM 组件，不访问业务 API，也不写入真实 Project、Job、Version 或设备凭据。

## 运行

从仓库根目录运行现有 Expo 入口：

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '192.168.31.209'
pnpm mobile:dev --lan --port 18081
```

地址使用当前电脑 WLAN 的 IPv4；网络变化后替换上述值。当前 Metro 已留用，不要重复启动。手机扫码打开 [预览二维码](evidence/preview-qr.png)，或在原项目首页点击“打开移动创作预览”；二维码内容为 `exp://192.168.31.209:18081/--/preview`。网页访问 <http://127.0.0.1:18081/preview>。Android、iOS 与网页共用预览源码；新版业务流程的原生实测当前只有 Android。电脑地址输入只是演示，不发送请求；演示配对码是 `246810`。

电脑侧在浏览器打开 [computer.html](computer.html)。它独立演示开启入口、短码有效期、配对失败和设备撤销，与手机预览不同步。两侧正式联动属于后续 API 实现。

建议先走一遍：连接电脑 → 打开夜行电台 → 编辑风格与歌词 → 开始生成 → 试听/拖动进度 → 输入版本名称并明确保存 → 版本历史。再使用“预览工具”体验断连、取消确认中断及保存响应丢失。

## 可以执行的操作

- 手工输入地址与配对码、显示配对加载/失败、重新配对、模拟电脑撤销访问。
- 项目列表、新建项目；输入项目名称后返回并再次打开，名称仍保留。
- 编辑风格、多行中文歌词、Seed 和时长上限，填入示例。留空或 `0` 表示自动时长，提交快照统一记为 `0`；手动输入 `5–360` 秒，`1–4` 与大于 `360` 的输入不会创建任务。沿用现有 Web 的用户输入约束，API 底层合法范围仍为 `0–360` 秒。
- 音乐风格最多 1024 个字、歌词最多 10000 个字、项目与版本名称最多 200 个字；输入控件和提交校验同时约束，提交快照按 API 规则裁掉首尾空白。
- 提交一次独立任务；演示电脑按实际等待时间进入排队、生成与完成，或失败。界面展示当前阶段与已等待秒数，不展示虚构的整体百分比。
- 取消排队/执行中的任务，先出现“取消确认中”，约 1.8 秒后读到取消终态。确认期间不能新建/重试任务；若连接中断，保留原取消请求，恢复查询终态后才允许明确重试。失败或已确认取消后，可以明确用原输入创建一个新任务；既有任务与当前草稿不被改写。终态通过 `endedAt` 固定总耗时。
- 试听 Candidate、播放/暂停、拖动原生进度条、跳转 10 秒、从头试听。版本与 Candidate 共用一个受生命周期管理的 `expo-audio` 播放器，页面切换保留播放位置；退到后台、断连或撤销配对时暂停，未连接期间禁止新试听。
- 给 Candidate 命名并明确保存 Version。保存中冻结候选与名称，禁止重复点击。确定保存失败时没有建立版本，保留名称与 Candidate，可编辑后再次保存；返回或切换页仍保留名称。
- 模拟电脑已保存成功但响应丢失：保存意图进入“结果待确认”，名称不可编辑，也不提供重复写入入口。点击“读取已保存版本并核对”，按原 Candidate 查询并展示已落库的 Version 和原保存名称。内部电脑记录仍然只在本预览内存，不涉及真实数据。
- 模拟断开连接、恢复连接并查询原任务。提交结果未知时，每次请求保留独立 `intentId → jobId` 关系；恢复只查询已接受的原任务，不按相同输入猜测，也不自动重发。
- 恢复连接只针对有效配对的设备。未配对或已撤销的设备不能通过恢复按钮、模拟断连按钮绕过重新配对。
- 在“预览工具”设置下一次配对/生成/保存失败、提交结果未知、保存响应丢失或取消确认中断，切换项目列表的空、加载、读取失败与正常状态。

草稿和保存记录仅由预览 Provider 保留在内存中，系统返回与预览内路由切换不会丢失；重载应用或离开预览后会重置。正式移动端需要另行实现设备凭据与草稿持久化、真实 API 任务恢复及鉴权。

## 音频来源与边界

`assets/morning-song.mp3` 复制自已有公开教程资产 `apps/docs/public/examples/morning-song.mp3`。旁边的 `morning-song-provenance.json` 保留原始来源、输入、时长与 SHA-256。这是既有 PR #58 保存的历史 YuE2 生成音频的 MP3 试听副本，约 35 秒；不是本轮推理结果，所有预览 Candidate/Version 都明确使用这一个样例。输入改变不会改变样例声音。

本预览不代表真实 GPU 生成、原始 FLAC 播放、真实手机持久恢复、局域网鉴权或独立 APK 已验收。上述能力按正式规格单独实施与验证。

## 验证记录

实现时读取了 Expo SDK 57 对应的已安装 `@expo/ui` 与 `expo-audio` 类型，使用 Expo UI 的通用原生 Button/TextInput/Switch/Slider 与原生 Stack。Project 列表使用 `FlatList`。Compose 控件宽度全部使用数值；输入由控件内部管理，再通过回调同步预览草稿。

Android 预览工具的 `Flag` 使用无 label 的通用原生 Switch 与外侧 React Native 文字，通过 Compose `semantics.contentDescription` 提供读屏标签。当前 Go 宿主不接受 label 版 Switch 自动添加的 `width(IntrinsicSize.Max)`；本地平台组件避开这一包装器，保留开关原生语义、testID 和行为。iOS 与网页继续使用 label 版通用 Switch，没有修改依赖源码。

Android 的 `SeekControl` 使用 Expo SDK 57 Go 已包含的 `@react-native-community/slider@5.2.0` 原生 SeekBar，宽度与播放器一致，抬手后提交一次 seek，拖动期间保留本地进度。当前 Go 实测中，Compose Slider 单点跳转准确、持续拖动却偏离手指终点；单独改为抬手提交、关闭 JS ScrollView 响应及禁用父原生滚动均未改善。没有将这些未证实的原因或探针保留为产品修复。iOS 与网页继续使用原通用 Slider 及 Host，testID、数值范围和 seek 回调保持一致。替代控件在原手势下实际到达 26 秒，原目标范围 `24–28` 秒断言通过；Maestro 反向拖动 `26 → 12–15` 秒断言也通过。

最终 `pnpm mobile:check` 和 SDK 依赖版本检查通过。实际 Android Maestro 已通过最终完整创作与保存流程（103 秒）和取消/未知保存恢复流程（103 秒）；Chromium 已通过配对、新建、输入边界、保存结果核对、项目空/加载/读取失败恢复、断连禁用试听与撤销后禁止恢复授权。非作者 Standards/Spec 审阅确认前一轮五项问题及最终原生控件替代无新增必修。

可复用的运行步骤、原始失败、音频及验收限制见 [工作流验证记录](../../verification/mobile-workbench-preview.md)。[Android 版本历史](evidence/android-version-history.png)、[异常恢复结果](evidence/android-recovered-version.png)和 [网页创作页](evidence/web-workbench.png)来自真实运行的预览；截图中的业务数据为模拟。Maestro 源码保留在 [maestro/](maestro/)，JUnit 结果保留在 [evidence/](evidence/)；详细日志留在 `.scratch/mobile-development/`。
