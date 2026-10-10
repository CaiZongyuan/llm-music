# 地址直连与稳定模型校验验证

来源：[#113](https://github.com/CaiZongyuan/llm-music/issues/113)、用户 2026-10-11 的明确纠正、[ADR-007](../adr/0007-direct-lan-and-stable-runtime-evidence.md)。基线为 `0bfa73bb9a761014550f0ba95d490d1a896a8608`。本次不再把配对或短时模型证明作为手机使用前提。

## 当前实际服务

手机地址 `http://192.168.31.209:18721`；Expo Go `exp://192.168.31.209:18081`；电脑工作台 `http://127.0.0.1:18722/settings`。

API 在原数据目录和 Server ID `aa8adce4-b293-49ec-978b-51b2ef38fe30` 上替换为直连版本，原 ComfyUI PID `38172` 和 GPU 数据保留。替换前没有活动 Job，API 与 Web 通过各自原停止入口正常结束。新 API PID `9320`，Web PID `1404`；Metro PID `19000` 保持运行。旧启动器监控已移交 Root；没有重新启动 GPU 或恢复周期性模型哈希脚本。

实际 `/connection` 返回 `access_method: direct`、`pairing_available: false` 和 LAN 地址。`/health` 的 Runtime 为 `ready`，四项 Capability 均就绪。两个模型的校验时间仍为 `2026-10-10T20:59:54.305961Z` 与 `20:59:55.269152Z`；实际读取时年龄为 943.85 / 942.88 秒，状态均为 `ready`，`max_age_seconds: null`。证明文件 SHA-256 为 `a825b1ff56c95c09b70c8dd16fb73be20778fefc607920127cf4bfcf937da7d6`。此次请求没有改写原时间或重新计算模型哈希。

同一真实 GPU Project `786f219b-4df9-4793-9937-880f05cffde1` 的无凭据项目读取返回 200；原 FLAC `1d832756-e601-4273-a78b-8f723e01c668` 的 HEAD 返回 200，Range 返回 206、`bytes 0-31/3520198` 和 `fLaC` 签名；原 Job WebSocket 接收 `job.updated`。没有再次提交 GPU 推理。

## 已执行检查

- 移动端：77/77 公共行为测试；应用与测试 TypeScript 通过。覆盖旧配对记录直接升级、Server ID 与草稿保留、丢失 Generate 回复的原 Job 恢复、无凭据 WS/原音频和离线草稿。
- API：98 项 CPU 检查通过；66 个源文件的严格 mypy 通过。覆盖真实双监听 socket、HTTP/WS/原音频、幂等重放与冲突、请求恢复和重启；三十天前的未变证明仍可使用，错 PID、实际源码变化、同大小模型指纹变化、文件缺失和未来时间仍拒绝。
- 客户端：由真实 CPU OpenAPI 生成；两次独立导出与已提交类型一致，TypeScript 通过。
- Web：构建与 TypeScript 通过；真实 Chromium 的 Runtime suite 5/5 通过。固定旧模型时间并再次读取的追加回归 1/1 通过；浏览器测试 TypeScript 通过。
- 文档：`pnpm docs:check` 与 `pnpm docs:build` 通过；19 个 Astro 文件零错误，62 个登记页面、66 个 HTML 与 5219 个内部引用已核对。
- 交互预览：桌面 1280×1000 与手机 390×844 的空、加载、连接成功、不可达、错误地址、项目空与失败恢复已在 Chromium 执行。实际电脑页面显示地址与刷新按钮。

实际运行收据保留在 Root 的 `.scratch/mobile-implementation/direct-lan-live/`；源同步收据在 `.scratch/mobile-implementation/direct-lan-sync/receipt.json`。同步保留已有 Web 修改，以文本三方合并更新重叠文件，未替换全局样式或依赖锁。

## Android 设备检查

新版公共 Maestro 流程使用地址直连；设备为 `emulator-5562`，Expo Go 57.0.9。首次运行保留了旧地址尾缀，应用正确返回 `invalid_address`；失败收据为 `.scratch/mobile-workflow/maestro-20261011-051752-373-eae3beeb/receipt.json`。定位为测试输入光标位置，修复仅涉及输入框右端定位、清除 100 字符和连接前精确地址断言，没有改产品 Field。

修复后使用同一个模拟器和保留的数据重跑，新流程 1/1 通过、退出码 0、实际耗时 2 分 20 秒。完成地址直连、新建 Project、填写中文输入、Generate、试听与按钮跳转、明确命名保存 Version，以及历史读取。使用隔离 Fake API 的 Server ID `9b77a6ad-5b1c-4771-baef-c3f71a2152c6`；没有把 Fake 结果当成真实 GPU 推理。收据与 JUnit 为 `.scratch/mobile-workflow/maestro-20261011-052239-099-e088a004/`。

随后同一 Expo Go 连接真实 GPU API，打开原 Project、已保存 Version `27207089-211d-4a20-9d1c-3094987cbdeb`，确认未自动播放，再明确试听原始 39 秒音频并返回后台。只读流程 1/1 通过、退出码 0、耗时 55 秒；没有输入 PIN、提交推理或保存新 Version。流、JUnit、截图分别在 Root `.scratch/mobile-implementation/direct-lan-gpu-readonly.yaml`、`direct-lan-gpu-native/` 与 `direct-lan-gpu-native.log`。

此前 Preview 1 APK 仍是旧配对实现；其历史验收不能作为新版直连 APK 的证明。iOS 使用用户实际 Expo Go 测试，本机没有 iOS 模拟器。

## 影响与收敛

手机普通路径移除 SecureStore、PIN 和设备 token；电脑面板改为一次只读地址请求与手动刷新，删除配对轮询和倒计时。HTTP、WS 与音频共享现有接入 socket 边界，不新增可选鉴权模式。旧配对管理接口仅保留兼容，普通流程不调用。原 SQLite 文档、冻结意图、幂等事务和显式保存 Version 保持原有生命周期。

生产源码由非作者按 Standards 与 Spec 独立审阅；预览和文档作者范围单列，不作为独立源审阅。当前修正没有数据库迁移和依赖变更。继续保留真实服务不可达、源码或模型已变化的错误；本次移除的是原证明的时间过期限制。
