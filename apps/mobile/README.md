# 声间移动端

Expo SDK 57 / React Native / Expo Router / TypeScript，属于根目录 pnpm workspace。首页进入连接或我的项目；`/connect` 接入真实局域网 API，SQLite 保存草稿与提交意图，SecureStore 保存设备凭据。正式工作流支持生成、取消、使用原输入明确重试、前台原始 FLAC 试听与 seek、命名保存 Version 和版本历史。数据与恢复规则见 [连接与数据接口](src/data/README.md)，播放器边界见 [音频模块](src/media/README.md)。`/bootstrap` 和 `/preview` 保留隔离预览。

从仓库根目录运行：

手机局域网连接时，手机与电脑使用同一 Wi-Fi，启动：

```powershell
pnpm mobile:dev --lan --port 18081
```

在 Expo Go 中扫描终端二维码，或输入 `exp://<电脑的 Wi-Fi IPv4 地址>:18081`。电脑有多个网卡时，可先把当前进程的 `REACT_NATIVE_PACKAGER_HOSTNAME` 设置为 Wi-Fi IPv4，确保链接使用正确网卡。手机需要兼容 SDK 57 的 Expo Go。Metro 的 exp 地址用于加载 App；`/connect` 需要电脑显示的 FastAPI LAN HTTP 地址与六位配对码，两者是不同服务。启动 Metro 前先运行 `pnpm --filter @llm-music/api-client build`。

只验证模拟器或本机浏览器时，使用 loopback 模式：

```powershell
pnpm install --frozen-lockfile
pnpm mobile:dev --localhost --port 18081
```

浏览器中的隔离预览为 <http://127.0.0.1:18081/preview>；原始音频的原生解码验收在 Android 上运行。Android Emulator 或 USB 真机使用兼容 SDK 57 的 Expo Go；本机已创建 Shengjian_Expo57 AVD。也可由 Expo CLI 打开已运行的模拟器：

```powershell
pnpm mobile:android --localhost --port 18081
```

两条启动命令选择其一；已有 Metro 时直接连接即可。首次 Expo Go 开发菜单可能需要点击 Continue，再关闭菜单。模拟器通过 SDK ADB reverse 连接 Metro，具体命令见验证记录。

验证入口：

```powershell
pnpm mobile:check
pnpm --filter @llm-music/mobile test
pnpm --filter @llm-music/mobile check:test
pnpm test:mobile
```

test:mobile 要求 Metro 已就绪、目标设备已启动、Expo Go 已安装，默认设备为 emulator-5562，开发 URL 为 exp://127.0.0.1:18081。它显式使用 Android SDK 的 ADB，默认查找 %USERPROFILE%\.maestro\bin\maestro.bat。其他设备或 Maestro 路径可以指定：

```powershell
pnpm test:mobile -Device emulator-5562 -ExpoUrl exp://127.0.0.1:18081 -MaestroPath C:\Tools\maestro\bin\maestro.bat
```

测试证据保存到 .scratch/mobile-bootstrap/maestro-<时间>/，包含 JUnit、命令、日志和截图。`test:mobile` 针对原初始化页面；正式配对、持久恢复、创作与原始音频使用独立验收流程。物理真机、独立 APK 与真实 GPU 闭环的证据另行记录。

正式正常工作流通过 `scripts/test-mobile-workflow.ps1` 运行。先启动隔离 Fake API，并在目标应用中完成配对；从仓库根目录指定实际设备、已保存的 LAN 地址和该隔离数据库的 `server_id`：

```powershell
./scripts/test-mobile-workflow.ps1 -Device emulator-5562 -AppId host.exp.exponent `
  -ExpoUrl exp://<电脑IPv4>:18081 -FakeApiUrl http://127.0.0.1:18700 `
  -PairedApiUrl http://<电脑IPv4>:18701 -ExpectedServerId '<server_id>' -Paired -Isolated -CheckBackground
```

流程会创建独立命名的 Project/Job/Version，验证中文多行输入、生成、试听按钮、seek、明确保存与历史；`-CheckBackground` 还检查返回前台后没有自动播放。凭据与服务启动由调用者管理，脚本不读取 PIN 或设备 token。证据保留在 `.scratch/mobile-workflow/`。独立 APK 模式使用 `-AppMode Apk -AppId com.shengjian.mobile`，省略 `-ExpoUrl`，在同一 APK 中先完成配对。此脚本不能代替原始字节、slider 拖动、真实 GPU 和物理设备验收。

Android 内测 APK 使用 `apps/mobile/eas.json` 的 preview profile 和根目录 `.github/workflows/eas-build.yml`，通过固定 `@react-native-feel/deploy@0.3.0` 触发 GitHub Actions；Windows 使用短路径和仅执行目录的 hoisted node linker 完成本地构建。试构建、签名、显式 build ID 下载及 GitHub Release 的范围见 [部署调查](../../docs/research/mobile-react-native-deploy-facts.md)。APK 内嵌 JS；日常开发继续用 Expo Go。

Windows 启动脚本使用 Node IPv4-first DNS，解决本机 --localhost 仅绑定 IPv6、而 ADB 与浏览器访问 IPv4 的问题。SDK 依赖经 expo install 校验，统一使用根锁文件。

初始化环境与清理方法见 [启动验证](../../docs/verification/mobile-bootstrap.md)；连接和持久恢复见 [客户端核验](../../docs/verification/mobile-client-core.md)；保留预览见 [mobile-bootstrap-v1](../../docs/previews/mobile-bootstrap-v1/README.md)。
