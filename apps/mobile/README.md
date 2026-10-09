# 声笺移动端初始化

Expo SDK 57 / React Native / Expo Router / TypeScript，属于根目录 pnpm workspace。当前页面是隔离的启动验证预览：中文输入、回显、点击计数及手动空/加载/失败/就绪状态只写内存。

从仓库根目录运行：

手机局域网连接时，手机与电脑使用同一 Wi-Fi，启动：

```powershell
pnpm mobile:dev --lan --port 18081
```

在 Expo Go 中扫描终端二维码，或输入 `exp://<电脑的 Wi-Fi IPv4 地址>:18081`。电脑有 VPN/WSL 等虚拟网卡时，可先把当前进程的 `REACT_NATIVE_PACKAGER_HOSTNAME` 设置为 Wi-Fi IPv4，确保链接使用正确网卡。手机需要兼容 SDK 57 的 Expo Go。此连接用于开发服务器，业务 FastAPI 接入与配对属于后续功能。

只验证模拟器或本机浏览器时，使用 loopback 模式：

```powershell
pnpm install --frozen-lockfile
pnpm mobile:dev --localhost --port 18081
```

浏览器预览为 <http://127.0.0.1:18081/>。Android Emulator 或 USB 真机使用兼容 SDK 57 的 Expo Go；本机已创建 Shengjian_Expo57 AVD。也可由 Expo CLI 打开已运行的模拟器：

```powershell
pnpm mobile:android --localhost --port 18081
```

两条启动命令选择其一；已有 Metro 时直接连接即可。首次 Expo Go 开发菜单可能需要点击 Continue，再关闭菜单。模拟器通过 SDK ADB reverse 连接 Metro，具体命令见验证记录。

验证入口：

```powershell
pnpm mobile:check
pnpm test:mobile
```

test:mobile 要求 Metro 已就绪、目标设备已启动、Expo Go 已安装，默认设备为 emulator-5562，开发 URL 为 exp://127.0.0.1:18081。它显式使用 Android SDK 的 ADB，默认查找 %USERPROFILE%\.maestro\bin\maestro.bat。其他设备或 Maestro 路径可以指定：

```powershell
pnpm test:mobile -Device emulator-5562 -ExpoUrl exp://127.0.0.1:18081 -MaestroPath C:\Tools\maestro\bin\maestro.bat
```

测试证据保存到 .scratch/mobile-bootstrap/maestro-<时间>/，包含 JUnit、命令、日志和截图。测试针对本初始化页面；FastAPI/GPU 创作、局域网配对、物理真机与独立产品 APK 属于后续工作。

Windows 启动脚本使用 Node IPv4-first DNS，解决本机 --localhost 仅绑定 IPv6、而 ADB 与浏览器访问 IPv4 的问题。SDK 依赖经 expo install 校验，统一使用根锁文件。

实际结果、环境准备与清理方法见 [验证记录](../../docs/verification/mobile-bootstrap.md)；保留预览见 [mobile-bootstrap-v1](../../docs/previews/mobile-bootstrap-v1/README.md)。
