# Windows Android Emulator 与 Maestro 事实核查

核查日期：2026-10-09（Asia/Taipei）。本文是规划输入，不是安装教程、已完成的设备验收或架构决定。未安装软件、启动模拟器、启动 ADB server、修改网络、防火墙或系统环境变量。

用户在第二轮访谈后纠正开发环境为纯 Windows。当前方案中代码、Metro、Android Emulator、ADB 和 Maestro 均在 Windows 运行；下文 WSL 内容是此前问题的补充调研，不是当前环境要求或实施步骤。

## 结论与验证边界

Maestro 当前支持 Windows 原生 CLI，纯 Windows 开发与测试具有官方支持路径。此前调查的 WSL Ubuntu 开发与 Windows Android Emulator 连接也有官方方案；官方对 WSL 方案说明仅在严格必要时使用，因为它需要额外端口配置。[M1]

这些事实证明方案具有官方支持路径，尚未证明当前机器可以完成测试。本机只完成了只读环境盘点，没有执行一次 Expo Go 或 Maestro Flow。

## 版本来源

- 查询 GitHub Releases API 时，Maestro 最新发布为 `cli-2.11.0`，发布时间 `2026-09-29T13:36:34Z`。[M2]
- 以下实现事实固定到 `cli-2.11.0`，不将移动的 `main` 作为验收版本。该版本使用 `dev.mobile:dadb:2.0.0`。[M3]
- 官方安装文档要求 Java 17 或更高；Windows 原生安装入口是 release 中的 `maestro.zip`，将解压目录的 `bin` 加入 PATH。[M1]
- Android driver 源码的 `minSdk = 24`、`compileSdk = 37`、`targetSdk = 37`，Kotlin `jvmTarget = 17`。编译目标不等于所有设备版本、应用和操作均已验证兼容。[M4]

## 补充调研：WSL 启动 Windows 模拟器

Microsoft 明确支持从 WSL 调用 Windows `.exe`。调用的程序以当前 Windows 用户运行，并出现在 Windows Task Manager；参数不自动改写，因此路径须使用目标 Windows 工具理解的格式。[W1]

Android Emulator 官方命令行入口是 `emulator -avd <avd_name>` 或 `emulator @<avd_name>`。[A1] 因此在已安装 Windows SDK、已创建 AVD、WSL interop 启用时，可以从 WSL 调用 Windows `emulator.exe`。这是一条由两份官方工具契约组合出的启动路径，本机没有执行它。

Microsoft 建议使用 Linux 工具开发时，将项目文件保存在 WSL 文件系统中以获得较好性能。[W1] 这不证明 Expo CLI 的所有自动模拟器发现和启动动作都会跨 WSL/Windows 工作；Expo CLI 自动发现、SDK 路径和实际 deep link 打开须另行验收。

## 补充调研：跨 WSL 的 ADB 与 Maestro 连接关系

官方 WSL 文档给出的连接方式如下。这里只记录文档中的命令，没有执行；其中 `<WINDOWS_IP>` 是占位符。[M1]

Windows PowerShell：

```powershell
adb -a -P 5037 nodaemon server
```

WSL：

```bash
export ADB_SERVER_SOCKET=tcp:<WINDOWS_IP>:5037
adb devices
maestro --host <WINDOWS_IP> test flow.yaml
```

`adb -a` 使 server 监听所有网络接口；`-P 5037` 指定 ADB server 端口。Android ADB 客户端源码优先读取 `ADB_SERVER_SOCKET`，除非命令显式指定 `-L`、`-H` 或 `-P`。[A2] 此监听方式是否需要当前 Windows/Hyper-V 防火墙规则，是本机待验证项。

Maestro CLI 使用自己的连接实现。`cli-2.11.0` 的参数是分别定义的 `--host`（字符串）、`--port`（整数）、`--driver-host-port`（整数）；`--host` 不是 `host:port` 语法。[M5]

- 未给出 `--port` 时，设备枚举调用 `Dadb.list(host)`。固定的 dadb 2.0.0 实现先请求指定 host 的 ADB server（默认 `5037`），没有返回设备时才尝试直接连接模拟器端口。[M6][D1][D2]
- 给出 `--port` 时，Maestro 调用 `AndroidDeviceConnection.open(host, port)`，该方法通过 `Dadb.create(host, port)` 直连设备的 `adbd`。因此 `--port 5037` 不能被当作“设置 ADB server 端口”的等价命令。[M6][M7]
- `ADB_SERVER_SOCKET` 是 ADB 客户端变量；上述 Maestro/dadb 方法明确使用传入的 host 和默认 server port。只设置这个变量不能被当作已经给 Maestro 配置好了 Windows host。[M7][D1][D2]
- driver 的默认端口是 `7001`。该版本通过 `AdbSocketFactory` 和 `dadb.open("tcp:$port")` 承载 gRPC；`2.5.0` changelog 明确记录用直接 ADB socket 替代 Android TCP port forwarding。不能将旧教程中额外开放或转发 Windows `7001` 的步骤直接套用到当前版本。[M7][M8]

设备可枚举、Maestro driver 可以工作、Expo Go 能加载 Metro、客户端能访问 FastAPI 是四项不同检查。`adb devices` 成功不能替代其余三项。

## 网络地址不能混用

对于当前纯 Windows 方案，Android Emulator 中的 `10.0.2.2` 是 Windows host loopback 的特殊别名，可用于访问宿主的开发服务；模拟器自己的 `127.0.0.1` 不是 Windows 电脑。[A3] 真实手机则需要局域网入口，不能使用这一模拟器专用别名。下表保留此前跨 WSL 调研；本机尚未验证其中任一路径。

| 调用方向 | 官方事实 | 本机待验证内容 |
| --- | --- | --- |
| Windows → WSL 服务 | 默认 NAT 下，Windows 应用可通过 localhost 访问 WSL 网络应用。[W2] | 实际 Metro/API 端口是否能从 Windows loopback 访问。 |
| WSL → Windows ADB server | 默认 NAT 下使用 Windows host IP；mirrored 模式可用 `127.0.0.1`。[W2] | 当前有效 networking mode、server 监听与防火墙可达性。 |
| Android Emulator → Windows host loopback | `10.0.2.2` 是 host loopback 的特殊别名；模拟器里的 `127.0.0.1` 指向模拟器自身。[A3] | `10.0.2.2:<port>` 经 Windows loopback 到 WSL Metro/API 的完整链路。 |
| 真实手机 → WSL/FastAPI | 不能从模拟器 `10.0.2.2` 路径推导真实手机可达。Microsoft 的 WSL LAN 指南另行说明 NAT 端口代理与 mirrored 模式。[W2] | 实机所需服务监听、入口、权限和连接边界。 |

当前 Expo CLI 文档的 Metro 默认端口是 `8081`，`--go` 明确选择 Expo Go，`--tunnel` 改变开发服务器的访问入口。[E1] Maestro React Native 示例的 `exp://127.0.0.1:19000` 只是文档示例，不能直接作为本项目 WSL + Windows Emulator 的正确地址或端口。[M9][E1]

Metro tunnel 属于 Expo 开发服务器配置；它不是已经配置好的 FastAPI API 入口。[E1] 本仓库 API CLI 将 `--host` 限制为 `127.0.0.1`、`localhost`、`::1`，而开发启动脚本硬编码 `127.0.0.1`。[R1][R2] 真实手机直接访问 API 的可行性不能由 Expo Go 扫码加载成功推导。

## Expo Go Flow 与元素定位

Maestro 官方 React Native 指南明确列出 Expo Go、development builds 和 EAS Workflows 兼容性。[M9]

- Expo Go 内的项目没有自己的独立已安装 package；不能用项目的自定义 `appId` 执行 `launchApp`。官方指定使用 `openLink` 打开项目开发 URL。[M9][M10]
- 独立构建或 EAS 构建可用自己的 Package Name / Bundle ID 执行 `launchApp`。[M9][M11]
- React Native 的 `testID` 可以作为 Maestro selector 的 `id`；也可按可见文字定位。具体组件、可访问性层级和嵌套元素须在实际页面上检查。[M9]
- `launchApp.clearState: true` 清理指定 package 的数据。Expo Go 的目标 package 是容器，不能将清理容器数据描述成只重置某一个业务 Project。Maestro Android 指南将它说明为等价于 `adb shell pm clear <package-name>`。[M11][M12]

尚未创建 Flow。首个 Flow 须记录具体 Expo Go binary、Expo SDK、Metro URL、Android system image、Maestro 版本和 Flow 文件，实际检查 deep link、开发提示层、加载状态及 `testID`。

## 官方页面与发布源码的冲突

1. `inputText` 页面及 known issues 仍写 Android 不支持 Unicode。[M13][M14] 但 issue `#146` 已关闭，并在 2026-07-01 指向修复 `#3211`；`2.7.0` changelog 记录 first-party Unicode input support，`cli-2.11.0` 源码对非 ASCII 输入调用 `inputUnicodeText`，通过 Maestro IME 提交 UTF-8 文本。[M15][M8][M16] 因此当前发布版不能被概括为“不支持中文歌词输入”；中文、多行歌词和 emoji 仍须用选定版本在本机执行验收。
2. QuickStart 仍列 API 29、30、31、33、34，并写 API 35/36 支持将在 Q2 2026 到来。[M17] `cli-2.11.0` changelog 已记录 API 37 的 `start-device` 支持。[M8] 设备基线须固定并实测，不能将前者陈旧时间表当作当前硬限制，也不能将后者的 device-start 支持当作所有 E2E Flow 已通过。

## 本机只读观察

盘点执行于 Windows PowerShell；没有进入或启动 WSL 发行版来检查 Linux 依赖。

| 检查 | 实际结果 |
| --- | --- |
| `wsl.exe --list --verbose` | `Ubuntu24.04` 是默认发行版，`Running`，WSL 2；`docker-desktop` 也是 `Running`、WSL 2。 |
| Windows `adb` | PATH 中找到 `D:\Environment\WSA\adb\adb.exe`；`adb version` 返回 Android Debug Bridge `1.0.41`、Version `36.0.0-13206524`。该目录名不能证明安装了完整 Android SDK 或可用 AVD。 |
| Windows `java` | PATH 中找到 Microsoft JDK；`java -version` 返回 `17.0.20`。 |
| Windows `emulator`、`maestro` | `Get-Command` 未找到。 |
| Windows 标准 SDK 位置 | `%LOCALAPPDATA%\Android\Sdk`、`D:\Environment\Android`、`D:\Environment\Android\Sdk`、`C:\Android\Sdk` 均不存在。 |
| Android SDK 环境变量 | Windows 当前进程的 `ANDROID_HOME`、`ANDROID_SDK_ROOT` 未设置。 |
| 默认 AVD / Maestro 用户目录 | `%USERPROFILE%\.android\avd`、`%USERPROFILE%\.maestro\bin` 不存在。 |
| Windows 已安装程序登记 | 常规 HKLM/HKCU Uninstall 登记中未发现 DisplayName 匹配 Android Studio、Android SDK 或 Maestro 的项目。便携安装不一定登记。 |
| 运行进程 | 查询 `emulator`、`qemu-system-x86_64`、`adb`、`java`、`studio64` 未返回进程。 |
| `.wslconfig` | 文件存在；只检查网络相关键，未找到显式 `networkingMode`、`localhostForwarding`、`firewall` 或 `dnsTunneling` 设置。尚未检查运行时有效 networking mode。 |

没有扫描所有磁盘或断言“全机未安装”。没有执行 `adb devices`，因为该命令可能启动 ADB server。Linux Java、adb、Maestro、Node/pnpm 和 Linux SDK 状态未知。

## 用户安装 Android Studio 后的只读复查

2026-10-09，用户说明已安装 Android Studio 后再次盘点。以下是新的实际观察，取代上表中“标准 SDK、默认 AVD 目录不存在”和“未发现 Studio 安装登记”的初次观察；初次盘点记录保留用于区分时间顺序。当前开发环境已由用户纠正为纯 Windows，未调查 Linux 依赖。

| 检查 | 安装后的实际结果 |
| --- | --- |
| Android Studio 安装 | Uninstall 登记为 `Android Studio`、版本 `2026.1`；开始菜单目标 `C:\Program Files\Android\Android Studio\bin\studio64.exe` 存在。配置目录名为 `AndroidStudio2026.1.3`；product-info 的 buildNumber 为 `261.26222.65.2613.15948027`。 |
| Windows SDK | `%LOCALAPPDATA%\Android\Sdk` 已存在；已定位后仅在此 Android 目录内使用 `rg --files` 查工具和组件元数据。 |
| Emulator | SDK `emulator/source.properties` 记录 `37.2.12`，`emulator.exe` 存在。 |
| SDK adb | SDK `platform-tools/source.properties` 记录 `37.0.1`；该路径下的 `adb.exe version` 返回 `1.0.41`、Version `37.0.1-15733141`。此命令未启动 ADB server。 |
| Build tools | `build-tools/36.0.0`，组件元数据版本 `36.0.0`。 |
| Android 平台与源码 | `platforms/android-37.0` 与 `sources/android-37.0`；平台描述 `Android SDK Platform 17`，ApiLevel `37.0`，Revision `2`，PreviewSdkInt `0`。这里只确认安装元数据，没有编译或运行本项目。 |
| AVD | `%USERPROFILE%\.android\avd` 已存在，但递归只读文件计数为 `0`；`emulator.exe -list-avds` 退出码 `0`，没有列出 AVD。 |
| System images | 此 SDK 的 `system-images` 目录不存在；当前没有发现可以启动的已配置 AVD。没有扫描其他 SDK 或自定义 AVD 路径。 |
| Command-line tools | 此 SDK 的 `cmdline-tools` 目录不存在，未找到其 `sdkmanager.bat`，没有执行 `sdkmanager`。 |
| 硬件加速 | `emulator.exe -accel-check` 退出码 `0`，输出 `WHPX(10.0.26200) is installed and usable.`。这是加速器可用检查，未证明某个 AVD 已成功开机。 |
| Hypervisor | `Win32_ComputerSystem.HypervisorPresent = true`。同时 CIM CPU 的虚拟化相关布尔字段返回 `false`；不据此推断 BIOS 虚拟化关闭，Emulator 的实际 WHPX 检查结果为可用。 |
| Windows 工具路径 | `Get-Command adb` 仍指向旧的 `D:\Environment\WSA\adb\adb.exe`；`emulator`、`maestro` 未在当前 PATH 找到。后续检查须明确使用 SDK 路径，不能把 PATH 中的旧 adb 当作新安装的 SDK adb。 |
| SDK 环境变量 | 当前 Windows 进程的 `ANDROID_HOME`、`ANDROID_SDK_ROOT`、`ANDROID_AVD_HOME`、`ANDROID_USER_HOME` 仍未设置。 |
| 运行进程 | 本轮查询 `studio64`、`emulator`、`qemu-system-x86_64`、`adb` 未返回进程。 |

只读复查已确认 Studio、SDK 工具和 WHPX 可用。尚需配置并固定 system image/AVD，检查 Maestro 安装与版本，再执行 Expo Go 和独立 APK 的设备验收。本轮没有安装组件、创建 AVD、启动模拟器或 ADB server，也没有修改 PATH、环境变量、网络或防火墙。

## 尚需实际验证

1. 查明 Windows Android SDK、Emulator、可用 AVD 及硬件加速状态；固定 system image 和 Expo Go binary。
2. 查明 Windows Node/pnpm/Java/adb/Maestro 的实际版本及 SDK 路径，确认使用同一套 Android SDK tools。
3. 验证 Windows 启动/连接 AVD，使用 Windows 原生 Maestro，不把 WSL 跨系统连接作为当前前提。
4. 验证目标设备可以加载 Metro bundle，Fast Refresh 和重新打开 deep link 均工作。
5. 分别验证 HTTP 请求、WebSocket、输出音频读取与播放经过同一已说明的 API 入口；API 不可达时检查可见错误和恢复。
6. 运行真实 Maestro Flow，验证 React Native `testID`、中文及多行歌词输入、提交、任务恢复、Candidate 试听与显式保存 Version。UI Flow 的成功不能代替音频内容或真实 GPU 推理验收。

## 来源

正文中的编号链接直接指向官方文档、固定版本源码或仓库源码。在线页面按核查日期读取；它们可能晚于或落后于所选发布版。

[M1]: https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli
[M2]: https://github.com/mobile-dev-inc/Maestro/releases/tag/cli-2.11.0
[M3]: https://github.com/mobile-dev-inc/maestro/blob/cli-2.11.0/gradle/libs.versions.toml
[M4]: https://github.com/mobile-dev-inc/maestro/blob/cli-2.11.0/maestro-android/build.gradle.kts
[M5]: https://github.com/mobile-dev-inc/maestro/blob/cli-2.11.0/maestro-cli/src/main/java/maestro/cli/App.kt
[M6]: https://github.com/mobile-dev-inc/maestro/blob/cli-2.11.0/maestro-client/src/main/java/maestro/device/DeviceService.kt
[M7]: https://github.com/mobile-dev-inc/maestro/blob/cli-2.11.0/maestro-client/src/main/java/maestro/android/AndroidDeviceConnection.kt
[M8]: https://github.com/mobile-dev-inc/maestro/blob/cli-2.11.0/CHANGELOG.md
[M9]: https://docs.maestro.dev/get-started/supported-platform/react-native
[M10]: https://docs.maestro.dev/reference/commands-available/openlink
[M11]: https://docs.maestro.dev/reference/commands-available/launchapp
[M12]: https://docs.maestro.dev/get-started/supported-platform/android
[M13]: https://docs.maestro.dev/reference/commands-available/inputtext
[M14]: https://docs.maestro.dev/extra-materials/troubleshooting/known-issues
[M15]: https://github.com/mobile-dev-inc/Maestro/issues/146
[M16]: https://github.com/mobile-dev-inc/maestro/blob/cli-2.11.0/maestro-client/src/main/java/maestro/drivers/AndroidDriver.kt
[M17]: https://docs.maestro.dev/get-started/quickstart
[D1]: https://github.com/mobile-dev-inc/dadb/blob/v2.0.0/dadb/src/main/kotlin/dadb/Dadb.kt
[D2]: https://github.com/mobile-dev-inc/dadb/blob/v2.0.0/dadb/src/main/kotlin/dadb/adbserver/AdbServer.kt
[W1]: https://learn.microsoft.com/en-us/windows/wsl/filesystems
[W2]: https://learn.microsoft.com/en-us/windows/wsl/networking
[A1]: https://developer.android.com/studio/run/emulator-commandline
[A2]: https://android.googlesource.com/platform/packages/modules/adb/+/refs/heads/main/client/commandline.cpp
[A3]: https://developer.android.com/studio/run/emulator-networking-address
[E1]: https://docs.expo.dev/more/expo-cli/
[R1]: ../../services/api/src/music_api/cli.py
[R2]: ../../scripts/dev_api.py
