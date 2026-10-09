# Windows 移动端初始化验证

日期：2026-10-10。用户授权先初始化 mobile 并试跑；本轮创建 `apps/mobile`，接入 pnpm workspace，验证 Expo Go 的加载和交互。本记录属于维护指南，没有登记为公开教程。

## 启动与测试

在仓库根目录运行：

```powershell
pnpm mobile:dev --localhost --port 18081
```

此公开入口已实际启动 Metro，<http://127.0.0.1:18081/status> 返回 `packager-status:running`，浏览器预览为 <http://127.0.0.1:18081/>。Android 使用 SDK ADB reverse 后打开开发链接：

```powershell
$mobileAdb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
& $mobileAdb -s emulator-5562 reverse tcp:18081 tcp:18081
& $mobileAdb -s emulator-5562 shell am start -a android.intent.action.VIEW -d 'exp://127.0.0.1:18081' host.exp.exponent
```

当前设备为 `emulator-5562`，AVD 为 `Shengjian_Expo57`。关闭后可从 Android Studio Device Manager 启动该 AVD；默认启动的设备序号可能改变，以 SDK `adb devices` 的实际结果为准。

`pnpm test:mobile` 调用 [test-mobile.ps1](../../scripts/test-mobile.ps1) 和 [Maestro flow](../../apps/mobile/.maestro/bootstrap.yaml)。需要 Metro 就绪、目标设备启动、兼容 Expo Go 安装完毕；脚本先检查 readiness，再明确使用 SDK ADB。可传入其他设备、URL 或 Maestro 路径，见 [应用 README](../../apps/mobile/README.md)。

## 本次环境与准备

| 项目 | 实际使用 |
| --- | --- |
| 系统、Node、pnpm | 纯 Windows；Node 24.18.0；pnpm 11.22.0。 |
| 初始化 | `create-expo-app@latest`，固定官方 `expo-template-default@57.0.29`，Expo Router 的 `src/app` 结构。 |
| Expo、React Native、React | 57.0.27、0.86.3、19.2.3；依赖固定在根锁文件。 |
| Expo Go | 官方 Android 57.0.9 APK，SHA256 `14c18828a3d04e43922245920bd941b978fd1c7a5aec88a0188032f0bb4972ce` 与 release digest 一致。 |
| Android SDK | `%LOCALAPPDATA%\Android\Sdk`，ADB 37.0.1，Emulator 37.2.12；WHPX 检查通过。 |
| AVD | 本轮安装 Android 16 / API 36 Google APIs x86_64 revision 7，并创建 Pixel 7 `Shengjian_Expo57`。 |
| 命令行工具 | Google 官方下载包，SHA1 `57d04f2d75eb8e8fffc5000a987e5de4b5a63e9d` 已核对；当前 SDK Manager 转入 Android CLI，安装镜像时使用 `--no-metrics`。 |
| Maestro、Java | 官方 Maestro 2.11.0，Microsoft JDK 17.0.20；ZIP SHA256 `5384593cb4e7a106489e75a821d157dd43f4e438df6bc308b72e82c685e1283a` 与 release digest 一致。 |

Maestro 工具复制到 `%USERPROFILE%\.maestro\bin` 与 `lib`，没有更改全局 PATH；测试脚本禁用其匿名分析和推广通知。原 PATH 中 WSA ADB 36.0.0 仍存在，测试显式采用新 SDK ADB。没有改动全局网络、防火墙或账号配置。此前环境盘点与来源见 [Windows 调研](../research/mobile-windows-maestro-facts.md)、[Expo 调研](../research/mobile-expo-facts.md)。

## 真实验证结果

| 检查 | 结果 |
| --- | --- |
| `pnpm mobile:check` | TypeScript 通过。 |
| `expo install --check`、`expo-doctor` | SDK 依赖匹配；Doctor 21/21 通过。 |
| Android Expo Go | 实际加载原生页面；Maestro 验证点击、中文多行输入和回显。 |
| 四状态与恢复 | Maestro 验证失败 → 加载 → 就绪 → 空；这些状态为明确标示的内存演示。 |
| 硬重开 | 停止 Go、重新启动并打开项目；计数恢复 0，输入为空。 |
| `pnpm test:mobile` | 公开入口两次通过，分别 47s 和 46s；最终公开启动入口下的测试为 46s。 |
| Fast Refresh | 不重启应用，把页面文本改为临时标记；Maestro 确认新文本出现、点击次数保持 1；临时标记已还原。 |
| 真实 Chromium | 中文输入/回显、点击与四状态通过；390×844 下 document/body 宽度均为 390，无横向溢出。 |
| 网页导出 | `expo export --platform web --output-dir dist-preview` 通过。 |
| 原有 Web | `pnpm web:check` 构建与类型检查通过。 |
| 原有文档 | `pnpm docs:check`：15 个源/参考检查通过，Astro 19 文件 0 errors / warnings / hints。 |

验证输入是本次工作副本，不声称已提交或合并。原始证据在 `.scratch/mobile-bootstrap/`；最终公开测试记录为 `maestro-20261010-003524-692/junit.xml`，其命令、截图与日志在该时间目录。第一轮完整通过的 `maestro-controls.xml` 以及公开入口早先的 47s 记录均保留。截图见 [初始化预览](../previews/mobile-bootstrap-v1/README.md)。

## 失败与修正

- Windows 的 Metro 最初仅绑定 `::1`，localhost 可达而 `127.0.0.1` 不可达。启动脚本改用 Node IPv4-first DNS 后，IPv4 健康检查、ADB reverse 和浏览器通过。
- 初次原生运行因 Compose width 收到 `"100%"` 崩溃，日志为 `FieldCastException`。虽然 `@expo/ui` 的类型允许百分比，当前原生 record 只接受整数；控件改用窗口宽度计算数值后通过。RN 外层使用其自身支持的布局。
- Expo Go 首次开发菜单阻挡页面。Flow 增加可选 Continue / Close 后通过；原失败不计为通过。
- 网页输入的显式 worklet/共享状态处理未正确回显；改为控件自己管理输入、普通 JS 回调保存文本后，网页及 Android 多行回显通过。
- Maestro 2.11.0 的 Windows 日志仍出现会话心跳文件锁写入异常；没有阻断这些串行测试的通过结果，原始日志保留。并行测试与长时间多会话稳定性未验证。

失败记录分别在 `maestro-first`、`maestro-width-fix`、`maestro-onboarding`。临时 Fast Refresh 检查为 `hmr-before`、`hmr-after`。没有修改 Maestro 官方二进制。

## 依赖影响及验收边界

与初始化前根锁文件比较，已有五个 importer 的声明版本及直接包版本一致。新增 mobile 引入 terser 和 React Compiler，改变了 Astro/Vite 的可选 peer 上下文，因此执行了实际 Web/文档消费者检查。Web 仍使用 React 19.3.0，mobile 使用 SDK 57 的 React 19.2.3。

`pnpm peers check` 仍报告 Expo CLI 间接上下文中的 `@types/react-dom@19.3.0` / `@types/react@19.2.18` 不匹配；mobile 直接类型依赖匹配 SDK，TypeScript、Doctor、Android 和网页实际检查通过。没有将全仓 peer 检查计为通过，也没有为消除此提示改动 Web 类型版本。

本轮只证明初始化应用和 Expo Go / Maestro 工具链可运行；FastAPI 局域网接入、配对、GPU 创作、原始 FLAC、物理真机、独立产品 APK 和 iOS 尚未在此验收。页面及演示数据只存内存，没有业务写入。

## 留用与清理

保留 Metro 18081 和本轮后台 AVD，供用户查看预览；所有者记录为 `.scratch/mobile-bootstrap/metro-owner.json`、`public-launch-owner.json`、`lan-launch-owner.json`、`emulator-owner.json`。初始化验证时 Metro PID 36028、launcher PID 30540，后续局域网切换已将其替换；当前 Metro PID 37196、LAN launcher PID 14964，emulator PID 10052。启动时间及最新身份以各 owner 文件为准。SDK、AVD、Expo Go 和 Maestro 工具保留用于后续开发。

2026-10-10 用户要求手机直接通过局域网连接后，已改为 `pnpm mobile:dev --lan --port 18081`；选取 WLAN 的 IPv4，并仅在 launcher 环境设置 `REACT_NATIVE_PACKAGER_HOSTNAME`，避开虚拟网卡地址。Wi-Fi 地址的健康接口返回 200，Android manifest 的 bundle URL 与 debuggerHost 均指向该地址；`pnpm test:mobile -ExpoUrl exp://192.168.31.209:18081` 在模拟器实际通过（69s）。手机需要同网段 Wi-Fi 和 SDK 57 兼容 Expo Go；手机本身的连接尚待用户操作确认。未增加或修改防火墙规则，业务 FastAPI 仍保持现有边界。

停止模拟器前，用 SDK ADB 的 `-s emulator-5562 emu avd name` 核对 `Shengjian_Expo57`，匹配后再用 `emu kill`。停止 Metro 前核对 owner 文件的 PID/启动时间，避免停止其他服务；若自己在终端启动，则使用该终端的 Ctrl+C。此前两个本轮 Metro 进程已核对身份后停止并替换。浏览器测试会话在验证后关闭。

后续用户要求关闭 Expo 并自行手动启动。已核对 PID/启动时间后停止 LAN Metro 37196 和 launcher 14964，实际确认 18081 无监听；前文留用的 Expo 服务至此已停止，模拟器与工具安装继续保留。后续是否启动及其所有者以用户手动操作为准。

## iPhone 后续连接排查

用户报告 Android 手机可以连接，iPhone 先显示本地网络权限提示、随后要求 `npx expo login`。电脑端 iOS manifest 的 bundle URL/debuggerHost 已确认使用 WLAN 地址；iPhone Safari 连通性及客户端版本尚未收到结果，不把权限提示单独视为权限关闭的证明。

[Expo 官方登录说明](https://docs.expo.dev/troubleshooting/expo-go-sign-in-required/)明确：物理 iOS 设备打开开发服务器项目时，Expo CLI 与 Expo Go 必须登录同一 Expo 账号；Android 与模拟器不受该检查影响。电脑可在第二个终端运行 `pnpm --filter @llm-music/mobile exec expo login --browser`，用户自行完成浏览器登录；手机 Expo Go 登录同一账号，再点 Try Again。首次登录后 CLI 每次请求读取凭据，无需停止服务器；切换账号才需重启。此步骤尚未由 agent 执行，也不代表 iPhone 已通过运行验收。

用户随后报告 `--browser` 在调用 Windows `cmd.exe /c start` 时退出。检查已安装 CLI 的 `open.js` / `expoSsoLauncher.js` 后，使用其支持的 `BROWSER=none` 跳过浏览器启动器，重新运行相同登录命令，保留回调服务供用户手动打开新生成的链接。对实际 SDK 的 `openBrowserAsync` 非认证探针已确认该配置返回 false、没有启动 Windows 浏览器；没有执行或代替用户完成认证。之前登录进程已退出，因此不能继续使用那次生成的回调链接。也可不加 `--browser`，在终端交互登录。

用户确认登录成功后，iPhone 报告无法下载 development bundle。连续只读检查时未发现 Expo Node 进程，8081/8082/18081/18082 均无监听，直接访问 WLAN 的 `/status` 失败；用户同时报告 Safari 可以打开，不能以该反馈替代当时的服务端观测。继续排查后重新启动局域网 Metro，当前 Node PID 45676、launcher PID 55828，身份记录在 `metro-owner.json` 与 `ios-launch-owner.json`。健康接口 200，iOS manifest 的 LAN 地址正确，实际 iOS bundle 完整下载 6,313,782 bytes，首次生成加下载 11.84s，CLI 记录 iOS Bundled 9067ms。保留服务供用户重载；这证明当前服务端可交付 iOS bundle，不代表 iPhone 原生渲染已验收。

随后用户回复“已经成功了”，确认 iPhone 已成功打开当前初始化应用；此前用户已确认 Android 手机可连接。两种真机连接成功属于用户实际反馈，Android 模拟器 Maestro 及服务端 bundle 下载仍是独立的 agent 证据。iPhone 的具体客户端版本、逐项交互、Maestro、独立 APK 和完整业务流程未在此验证。Expo 局域网服务继续留用。
