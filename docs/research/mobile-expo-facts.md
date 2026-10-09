# 移动端事实核查：Expo SDK 57、Expo Go 与 Maestro

核查日期：2026-10-09。本文是规划调查记录，不是移动端实施规格，也不修改当前 [生产规划](../production.md)。本次只读取官方文档、npm Registry 与第一方发布源码；没有创建移动应用、安装依赖、编译二进制或运行设备测试。

## SDK 57 已正式发布

Expo 官方在 2026-06-30 发布 SDK 57，配套 React Native 0.86 与 React 19.2。发布说明记录了后续补丁修复：`expo@57.0.9` 配套 RN 0.86.2；`expo@57.0.17` 配套 RN 0.86.3。[官方发布说明](https://expo.dev/changelog/sdk-57)

2026-10-09 查询 npm Registry 的结果如下。dist-tag 是可变指针，不等于项目的锁文件。

| 包 | Registry 标签/版本 | 核查结果 |
| --- | --- | --- |
| `expo` | `latest = sdk-57 = 57.0.27` | SDK 57 是当前稳定标签；此版本在 2026-10-06T12:10:58.345Z 发布 |
| `expo` | `next = 58.0.6` | 不应因为 `next` 数字更大就当成 SDK 57 的配套依赖 |
| `expo-audio` | `latest = sdk-57 = 57.0.5` | SDK 57 音频包 |
| `expo-notifications` | `latest = sdk-57 = 57.0.22` | SDK 57 通知包 |
| `react-native` | `latest = 0.87.1` | RN 独立发布线；不是 SDK 57 的配套版本 |

来源：[expo Registry](https://registry.npmjs.org/expo)、[expo-audio Registry](https://registry.npmjs.org/expo-audio)、[expo-notifications Registry](https://registry.npmjs.org/expo-notifications)、[react-native Registry](https://registry.npmjs.org/react-native)。

从官方 npm 发布包 `expo@57.0.27` 的 `bundledNativeModules.json` 读取到以下配套版本。这里使用固定发布包，避免把 `latest` 文档或 RN 最新版本套入 SDK 57。

| 依赖 | SDK 57.0.27 配套值 |
| --- | --- |
| `react` | `19.2.3` |
| `react-native` | `0.86.3` |
| `expo-audio` | `~57.0.5` |
| `expo-document-picker` | `~57.0.3` |
| `expo-file-system` | `~57.0.7` |
| `expo-sharing` | `~57.0.22` |
| `expo-notifications` | `~57.0.22` |

来源：[固定版本元数据](https://registry.npmjs.org/expo/57.0.27)、[官方发布包](https://registry.npmjs.org/expo/-/expo-57.0.27.tgz)。本次直接下载发布包并在内存中读取 tar 内文件；没有运行包内代码。Expo 官方升级指南要求依赖与所选 SDK 配套，并使用 `expo install --fix` 和 `expo-doctor` 检查。[升级指南](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)

## Expo Go 的边界取决于原生二进制

Expo Go 自带固定的原生库。JS/TS 可以热更新；项目不能把新的原生模块、权限配置、Android Manifest、iOS capabilities、应用标识、应用图标或真实启动页写入已经安装的 Expo Go。development build 是本项目自己的原生应用，通常带 `expo-dev-client`，允许选择原生库和配置。[Development builds FAQ](https://docs.expo.dev/develop/development-builds/faq/)

development build 不代表每次修改都重新编译。只修改 JS/TS 时，使用开发服务器即可。原生依赖、应用配置或 SDK 发生相关变化时，需要重新生成/编译原生项目。[Development builds introduction](https://docs.expo.dev/develop/development-builds/introduction/)

Expo Go 与项目 SDK 需要匹配。Android 真机、Android Emulator 和 iOS Simulator 可安装兼容的 Expo Go；设备上的实际安装版本仍需检查。SDK 57 发布说明曾记录其商店版本待批准，并给出 CLI 与 `eas go` 安装渠道；这段历史说明不能证明 2026-10-09 任一商店/设备当前实际装有什么版本。[SDK 57 发布说明](https://expo.dev/changelog/sdk-57)、[SDK 不匹配 FAQ](https://docs.expo.dev/develop/development-builds/faq/#open-projects-using-other-sdk-versions)

### 与音乐工作台有关的能力

下表表示官方 API/二进制边界，不表示本仓库已完成设备验证。

| 能力 | SDK 57 / Expo Go 事实 | 需要独立核查的边界 |
| --- | --- | --- |
| 前台音频试听、暂停、seek、状态读取 | `expo-audio` 包含于 Expo Go，可加载本地资产或远程 URL | 真实 Asset 格式、HTTP 响应、网络错误、音频中断与设备行为 |
| 前台录音 | `expo-audio` 包含于 Expo Go，提供麦克风权限与录音 API | 当前录音权限、拒绝后的恢复、录音保存/上传；Go 内权限文案不是项目自己的文案 |
| 后台/锁屏播放 | `expo-audio` 有 API；项目配置需要 iOS `audio` background mode、Android 媒体播放 foreground service/权限 | Go 不能应用本项目原生配置；正式应用后台/锁屏行为需要用自己的二进制验证 |
| 后台/锁屏录音 | `expo-audio` 有 API；需要背景音频配置和 Android 录音 foreground service/相关权限 | 本项目原生服务声明、系统持久通知、权限、进出后台行为无法由 Go 代替验收 |
| 选择文件导入 | `expo-document-picker` 包含于 Expo Go，调用系统文件选择器 | 与文件系统一起读取时设置 `copyToCacheDirectory: true`；文件提供者、取消和大文件行为 |
| 下载/读取/上传文件 | `expo-file-system` 包含于 Expo Go；提供下载 API、应用文件访问及与 `expo/fetch` 配合上传的示例 | 设备路径不是桌面路径；应用缓存不等于永久 Asset 保存；断网、取消、大小限制与后端 multipart 兼容性 |
| 分享文件给其他应用 | `expo-sharing` 包含于 Expo Go；`shareAsync` 接受本地文件 URL | 系统分享目标是否处理对应 MIME/扩展名；分享不等于上传或可靠的永久文件保存 |
| 其他应用分享进本应用 | SDK 57 的 `expo-sharing` 文档有此功能，但标为实验性；iOS Share Extension / Android intent-filter 由 config plugin 配置 | Go 不能安装本项目自己的 extension/intent-filter；SDK 57 文档还提示 iOS 实现方式可能受未来系统变化影响 |
| 本地通知 | SDK 57 通知文档明确本地通知在 Expo Go 中仍可用 | 本地显示不能替代后端在客户端挂起/关闭后发送通知 |
| 远程 push | SDK 57 文档明确 Android Expo Go 从 SDK 53 起不支持，要求 development build；开发 FAQ 同样把远程 push 列为 Go 限制 | FCM/APNs/Expo 推送凭据、后台/关闭状态和自己的应用标识需要独立二进制及实际端到端验证 |
| 自定义原生模块 | Expo Go 只能调用预置的 native libraries | 添加未预置解码器、DSP 或其他 native modules 需要自己的 build |
| 自定义 scheme、Android App Links、iOS Universal Links | Go 使用自身 scheme/二进制；新增项目 scheme 需要创建新 development build | 正式 deep link/App Link 与网站关联需要自己的原生配置 |

以上来源均固定在 SDK 57 文档：[Audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)、[DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/)、[FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/)、[Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/)、[Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)。原生二进制与链接边界见 [Development builds FAQ](https://docs.expo.dev/develop/development-builds/faq/)、[Linking into your app](https://docs.expo.dev/linking/into-your-app/)。

不能把“需要本项目原生配置验收”写成“Expo Go 在所有情况下绝对不能后台播放”。SDK 57 分支的 Expo Go iOS `Info.plist` 本身包含 `audio` background mode；Go 实际后台行为取决于已安装二进制与系统。本次未运行 Go 后台/锁屏测试。[Expo Go iOS 配置源码](https://github.com/expo/expo/blob/sdk-57/apps/expo-go/ios/Exponent/Supporting/Info.plist)

SDK 57 音频文档另有明确 Android 前提：持续后台播放要启用 `setActiveForLockScreen`；未启用时，文档说明音频可能在约 3 分钟后停止。这个前提需要进入实际测试，不能用短暂切后台成功证明持续播放通过。[Audio 后台播放](https://docs.expo.dev/versions/v57.0.0/sdk/audio/#playing-audio-in-the-background)

`RecordingPresets.HIGH_QUALITY` 在 Android/iOS 默认使用 AAC 与 `.m4a`，不是 FLAC；默认录音写入缓存。若要持久保存，需要选择 document 目录或另行移动/上传文件。后端是否接受这类录音文件尚未以设备上传验证。[Audio 录音与预设](https://docs.expo.dev/versions/v57.0.0/sdk/audio/#recording-sounds)

## FLAC 不应被视为未经验证的统一播放承诺

SDK 57 音频文档把支持格式分别指向 Android Media3/ExoPlayer 与 Apple 媒体格式文档。官方 npm 发布的 `expo-audio@57.0.5` 源码确认：Android 使用 `ExoPlayer.Builder`，依赖 Media3 `1.9.0`；iOS 的 `AudioPlayer` 包装 `AVPlayer`。库本身没有提供一个所有设备一致的独立解码器。[Audio 文档](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)、[固定版本元数据](https://registry.npmjs.org/expo-audio/57.0.5)、[官方源码发布包](https://registry.npmjs.org/expo-audio/-/expo-audio-57.0.5.tgz)

Android 官方列出 FLAC 支持，并给出平台推荐范围：mono/stereo；采样率最高 48 kHz；推荐 16-bit。ExoPlayer 文档明确区分容器解析与 sample 解码：sample 支持依赖底层平台解码器；使用额外软件解码扩展需要手工编译并纳入应用。[Android 支持格式](https://developer.android.com/media/platform/supported-formats)、[ExoPlayer 支持格式](https://developer.android.com/media/media3/exoplayer/supported-formats)

Apple 文档列出 `kAudioFormatFLAC`，说明其表示 FLAC 格式并通过 flags 指示源数据位深。这个格式标识的存在不能单独证明任意 FLAC 文件在任意 iOS 版本上通过 `AVPlayer` 的远程播放、seek 和错误恢复都可用。[Apple FLAC 格式标识](https://developer.apple.com/documentation/coreaudiotypes/kaudioformatflac)

本次没有播放本项目原始 FLAC Asset，也没有检查真实目标设备。跨平台承诺需要以真实生成样本检查：channels、sample rate、bit depth、文件容器、HTTP URL、下载后播放、seek、长音频与失败恢复。需要播放派生格式与否仍属未决产品/技术选择；本文不做该决策。

## Maestro 可以测 Expo Go，但 appId 指向容器

Maestro 官方说明支持 Android/iOS React Native，也支持 Expo Go、development builds 与 EAS Workflows。它通过 accessibility 层操作真实视图；RN 的 `testID` 可作为 Maestro 的 `id` selector。[Maestro React Native 支持](https://docs.maestro.dev/platform-support/react-native)

Maestro flow 的 `appId` 表示 Android package name 或 iOS bundle ID。它不是 Project id，也不是 Expo 项目名。在 Android Expo Go 中，宿主包名是 `host.exp.exponent`，而不是未来产品的 `android.package`。[Maestro flow 配置](https://docs.maestro.dev/api-reference/configuration/flow-configuration)、[Expo CLI 固定提交源码](https://github.com/expo/expo/blob/50ac74f1ab5682c8e32b24da6e5e97dd4dbbb80f/packages/%40expo/cli/src/start/platforms/android/AndroidDeviceManager.ts)

测试 Go 中的项目，先针对 Go 容器，再用 `openLink` 打开项目开发 URL；不能用未来产品 appId 的 `launchApp` 当成已经安装了产品。自己的 development/standalone build 则可直接以自己的 package/bundle id 启动。[Maestro Expo Go 区别](https://docs.maestro.dev/platform-support/react-native#expo-go-vs-standalone-builds)、[openLink](https://docs.maestro.dev/api-reference/commands/openlink)、[launchApp](https://docs.maestro.dev/api-reference/commands/launchapp)

Expo 当前官方开发链接示例使用 `exp://<address>:8081`，路由路径用 `/--/` 分隔，例如 `exp://<address>:8081/--/details`。Maestro 文档中 `19000` 是示例值，不是当前 Metro 的必然端口；实际测试需要使用开发服务器输出的 URL。`127.0.0.1` 的可达性取决于设备/模拟器与端口转发，本文没有验证 WSL/Windows/Android 的实际网络路径。[Expo Linking](https://docs.expo.dev/linking/into-your-app/)、[SDK 57 Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/)

Android `clearState` 相当于 `adb shell pm clear <package>`，清除指定应用的数据/缓存/偏好。因此在 Go 上清除 `host.exp.exponent` 的对象是整个 Go 容器，而不是产品独立安装包。本次未执行任何清除操作。[Maestro clearState](https://docs.maestro.dev/api-reference/commands/clearstate)

## 尚未验证

- Windows Expo CLI、ADB、Android Emulator 与原生 Maestro 之间的实际连接及启动方式。用户已纠正为纯 Windows 开发，WSL 不属于当前方案；本文没有测试这些进程。
- 安装的 Expo Go 是否与 SDK 57 匹配；设备账户状态、初次加载提示与项目 deep link 是否可稳定自动化。
- 项目现有 API client 是否在 RN 的 `fetch`、WebSocket、Blob/FormData 与设备文件 URI 下兼容。可以调查复用，但不能声称已有设备兼容性结论。
- 真实生成 FLAC 在 Android/iOS 目标设备上的解码、seek、前后台及下载后播放。
- 系统文件导入/分享与当前 FastAPI 上传接口的实际配合。
- 前台/后台录音、持续锁屏播放、本地通知与真实 push 的端到端结果。
- Maestro 跑过真实移动端的任何 flow；文档上的 React Native 支持不等于本仓库设备测试已通过。

本文未登记到 `docs/site.json`，属于维护调研记录；没有变更公开文档页面、导航或发布内容。
