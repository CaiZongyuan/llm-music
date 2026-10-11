# 移动工作台预览验证

2026-10-10。本记录属于维护资料，不是公开产品教程。目标是验证 [移动工作台交互预览](../previews/mobile-workbench-v1/README.md) 可以在现有 Expo Go 环境运行，让用户在业务实现前体验完整新流程。已有 [初始化验证](mobile-bootstrap.md) 继续适用于工具安装与首次连接。

## 启动和就绪

从仓库根目录启动；当前服务已留用，可直接查看：

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '192.168.31.209'
pnpm mobile:dev --lan --port 18081
```

网络变化后使用电脑实际 WLAN IPv4。`http://127.0.0.1:18081/status` 应显示 `packager-status:running`。网页入口为 <http://127.0.0.1:18081/preview>；手机与电脑使用相同 Wi-Fi，在原初始化首页点击“打开移动创作预览”，或扫描 [二维码](../previews/mobile-workbench-v1/evidence/preview-qr.png)。二维码内容为 `exp://192.168.31.209:18081/--/preview`。iPhone 沿用用户已完成的同账号 Expo 登录。

配对输入是模拟，演示码为 `246810`。没有调用 FastAPI、ComfyUI 或真实数据库。重新加载将清空本次演示；预览内导航会保留草稿。浏览器打开 [computer.html](../previews/mobile-workbench-v1/computer.html) 查看电脑配对入口；它和手机示例彼此独立。

## Android Maestro

本次实际环境为纯 Windows、Node 24.18.0、pnpm 11.22.0、Expo 57.0.27、RN 0.86.3、Expo Go 57.0.9、Maestro 2.11.0 和 JDK 17.0.20。设备 `emulator-5562` 为 `Shengjian_Expo57`、API36 Google APIs x86_64。关闭后设备序号可能改变，以 SDK ADB 的实际列表为准。

以下已执行的两个 flow 保留在预览目录。每次独立运行前 force-stop Go，以清空上次的内存演示状态；只操作指定模拟器：

```powershell
$mobilePreviewAdb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$mobilePreviewMaestro = Join-Path $env:USERPROFILE '.maestro\bin\maestro.bat'
$env:MAESTRO_CLI_NO_ANALYTICS = '1'
$env:MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED = 'true'
& $mobilePreviewAdb -s emulator-5562 reverse tcp:18081 tcp:18081
& $mobilePreviewAdb -s emulator-5562 shell am force-stop host.exp.exponent
& $mobilePreviewMaestro --device emulator-5562 test docs/previews/mobile-workbench-v1/maestro/workbench.yaml --format junit --output .scratch/mobile-development/workbench-rerun.xml --test-output-dir .scratch/mobile-development/workbench-rerun
& $mobilePreviewAdb -s emulator-5562 shell am force-stop host.exp.exponent
& $mobilePreviewMaestro --device emulator-5562 test docs/previews/mobile-workbench-v1/maestro/recovery.yaml --format junit --output .scratch/mobile-development/recovery-rerun.xml --test-output-dir .scratch/mobile-development/recovery-rerun
```

恢复 flow 当前固定使用 localhost 18081。若更换端口，先同步 flow 中的开发链接与 ADB reverse；尚未声称测试过其他端口。根入口 `pnpm test:mobile` 仍测试初始化页，不包含本次工作台 flow。

## 实际结果与失败

| 检查 | 结果与实际覆盖 |
| --- | --- |
| `pnpm mobile:check` | TypeScript 通过。 |
| Android 正常工作流 | 最终 103 秒通过：错误/正确配对、2 秒输入拒绝、60 秒生成输入、演示 Job、实际 MP3 播放/暂停/跳转 10 秒、命名保存与历史。早先 106 秒结果也保留。 |
| Android 异常恢复 | 修复后原 flow 103 秒通过：取消确认中断后读取原任务，再明确重试；保存响应丢失后按原 Candidate/名称读取已保存版本。 |
| Chromium 390×844 | 配对、新建、时长校验、生成、试听、未知保存核对、历史、项目空/加载/读取失败重读、断连播放/seek 禁用、撤销后无法恢复授权。 |
| 电脑 HTML | 开启→模拟失败→重试配对→撤销；有效期检查在实际点击处理器中执行，避免 1 秒界面更新间隔越过过期边界。 |
| 非作者审阅 | 五项原问题已修复；八组实际模型边界探针通过。模型探针替换了音频与计时环境，原生验证独立记录。Android Flag 与最终 SeekBar 复核无新增必修；后者另有五组拖动、禁用、回调与外部更新探针。 |
| 共享依赖 | 与 HEAD 锁文件比较，原有 docs/Web/client/browser importer 完全相同；仅 mobile 增加 audio/预览依赖，并新增 private 预览 importer。没有用当前无关 Web 未提交变化作为本轮验证对象。 |

SDK 57 Go 的带标签 Switch 起初触发 `FieldCastException`，原因是内部 `width(IntrinsicSize.Max)` 在当前 Go 原生宿主不能转换为数值宽度。失败为 `.scratch/mobile-development/native-recovery-v1.xml`，详细日志与红屏截图在 `native-recovery-v1/`。Android 改为无标签原生 Switch、外侧文字及真实 `contentDescription`，原恢复 flow 在 `native-recovery-v2/` 通过；没有修改依赖源码。

截图核对还发现原生 seek track 只有 63px 宽。显式数值宽度后变为 995px（1080px 设备宽），同一几何断言通过，但持续拖动仍只到达起点附近。抬手提交、关闭 JS 滚动响应及禁止父原生滚动的局部探针均未解决；已撤掉这些探针，没有改模型或依赖源码来绕过问题。

Android 最终使用 Expo SDK 57 内置的 `@react-native-community/slider@5.2.0` 原生 SeekBar，iOS/web 保留原通用 Slider。对相同 ADB 手势 `482,1604 → 780,1604`、400ms，目标为约 26 秒，原 Compose 实测为 18–19 秒；替代控件实际达到 `0:26 / 0:35`，原 `24–28` 秒断言通过，没有降低阈值。证据为 `.scratch/mobile-development/slider-native-final-position.xml`。Maestro 的反向拖动也通过 `26 → 12–15` 秒断言；随后播放断言因自动化等待界面稳定而越过所写时间窗口，不能将该次完整 flow 计为通过。原始输出分别保留在 `native-slider-final/`、`native-slider-final-v2/`、`native-slider-final-v3/`；另一次小数百分比坐标不被 Maestro 解析，是测试输入失败。最终正常工作流 `native-workbench-v2/` 103 秒通过，播放操作限定 `waitToSettleTimeoutMs: 300`，避免不断变化的播放进度拖延测试动作。

Maestro Windows 会话日志仍有心跳文件锁异常；上述串行 flow 可以通过，未验证并行或长期多会话稳定性。原始失败保留，不将失败尝试计为通过。

稳定截图和 JUnit 结果在 [evidence/](../previews/mobile-workbench-v1/evidence/)，[来源记录](../previews/mobile-workbench-v1/evidence/receipt.json)保留最终源码 hash、截图来源、环境及边界，详细测试输出在 `.scratch/mobile-development/`。当前为未提交工作树中的预览，非已合并产品。

## 验收边界和留用

所有生成/配对/项目/保存数据为内存演示。真实播放使用来源明确的历史 35 秒 MP3；没有生成本次输入的声音，也未测试原始 FLAC、HTTP 音频鉴权/Range、真实设备撤销、进程重启后持久恢复、真实 GPU 或独立 APK。Android/iPhone 初始化真机连接成功来自用户反馈；新版完整工作流的原生 agent 实测当前只有 Android 模拟器。

预览作为 private pnpm workspace 接入 SDK 默认 monorepo watch folders；没有自定义 Metro resolver。保留 Metro 18081 与当前模拟器供用户体验，最新进程身份见 `.scratch/mobile-development/metro-owner.json`、`metro-launch-owner.json`，模拟器原 owner 见 `.scratch/mobile-bootstrap/emulator-owner.json`。停止前核对 PID、启动时间和 AVD 名；不按历史 PID 停止当前服务。临时 browser 会话在验证后关闭，截图、失败日志和工具安装保留。

下一步是在 [UI 反馈](../ui/mobile-workbench-preview.md) 记录本次新流程的确认，再按 [实施草案](../design/mobile-delivery-plan-draft.md) 发布正式规格和实施票据，接入同一 FastAPI。
