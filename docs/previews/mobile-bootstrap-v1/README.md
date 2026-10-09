# 移动端初始化验证预览

2026-10-10，用户授权“先初始化一个 mobile，然后试一下能跑通”。预览使用 [apps/mobile](../../../apps/mobile/README.md) 的真实 Expo 源码，无重复实现。

从仓库根目录运行 `pnpm mobile:dev --localhost --port 18081`，在 <http://127.0.0.1:18081/> 打开网页，或在 Android Expo Go 中通过 SDK ADB reverse 打开 `exp://127.0.0.1:18081`。运行前提和具体命令见应用 README 与验证记录。

可执行操作包括中文多行输入与回显、点击计数、手动空/加载/失败/就绪状态及失败后重新加载。所有输入和演示状态只写内存，刷新或重启会清空；页面不访问业务 API、数据库、ComfyUI 或 GPU。

视觉沿用已确认的黑色 Acid Hardware 色板，Android 控件来自 `@expo/ui`。本预览供初始化与工具链验证，正式的项目、配对、生成、试听和保存流程仍需单独预览。

Android Expo Go 的 Maestro 操作、硬重启重开与 Fast Refresh 已实际通过；网页端在真实 Chromium 中完成输入回显和演示状态验证。完整证据见 [验证记录](../../verification/mobile-bootstrap.md)，反馈与范围见 [UI 记录](../../ui/mobile-bootstrap.md)。

保留截图：[Android](android.png)、[网页窄屏](web.png)。
