# 移动端连接与持久恢复核验

日期：2026-10-10。规格：[SPEC-017/M3 #102](https://github.com/CaiZongyuan/llm-music/issues/102)。固定实现起点：`d011c2f2228fdbf95aab570ec05a0edbbe388abb`。本记录覆盖 `apps/mobile` 的真实连接、客户端、草稿与冻结提交意图；业务页面、独立 APK、物理真机和真实 GPU 闭环分别验收。

## 公开接口检查

Node 通过 session 的公开接口注入外部存储、随机数、HTTP 与 WS provider，覆盖配对回复丢失、并发凭据写入、存储失败保留编辑、原请求恢复、404不自动重发、Version保存核对、原 Job 取消、前后台与电脑隔离、超时、受保护音频请求和观察生命周期。领域路径/body/receipt 类型来自共享生成 client。

独立审查补充的反例已复现并修复：公开电脑索引元素不能改变保存的地址；源乐谱生成/Cover 的显式 null 保存父关系按 producer 契约处理；观察者在回调中取消订阅后不能创建孤立 WS。相同电脑检查失败仍保留 server/device 缓存身份，同时禁止授权业务请求。

检查命令在仓库根目录运行：

```powershell
pnpm --filter @llm-music/api-client build
pnpm --filter @llm-music/mobile test
pnpm --filter @llm-music/mobile check:test
pnpm mobile:check
pnpm --filter @llm-music/mobile exec expo install --check
git diff --check
```

审查修复后，本次23项公开接口测试、应用与测试 TypeScript、Expo依赖版本检查及 diff检查均通过。当前 session SHA256：`a5bf8a9bf3293570b0959bff13f5c46423448d4f8db9dd1db0a8d1c4a8b6d6ff`。有限简化只复用 checkingServer 的同电脑缓存身份处理，并保留受控连接、持久化和 epoch 守卫；未修改共享 API schema、backend、Web或保留预览。

这些 provider 故障是公开接口回归，不代表原生 SQLite 或 SecureStore 物理故障。原生故障取证由隔离模拟器验收单独记录。

## 实际 Expo Go / 真实 API 首轮

Root 在 `emulator-5562`（API36 / Shengjian_Expo57）使用 Expo Go 57.0.9 与 SDK57 执行实际原生核验。API 是固定基线的真实 FastAPI，Runtime 为隔离 Fake Runtime CPU。真实配对和设备凭据冷启动首先通过；服务端接受 claim 后回复丢失时，冷启动只查询已保存设备，无第二次 claim。

随后用实际 SQLite 保存中文多行草稿，冻结 Generate，故障代理转发真实 LAN202接受响应后丢弃回复。App 显示 unknown；停止并重新启动 Expo Go 后，HTTP 按 `/connection`、`/device`、原 `/requests/{id}`、原 Job 的顺序恢复到 confirmed，草稿和后台 Job inputs 一致。整轮生成 POST 恰好1次。

冻结输入：

```json
{
  "style": "清晨的电子音乐",
  "lyrics": "第一句歌词\n第二句歌词",
  "seed": 42,
  "max_seconds": 0
}
```

原请求：`1f80914b-7e3e-4f21-90ec-12b9de9a8ecc`；原 Job：`667ee0f7-00d2-4c60-8ae1-766fdbb77e9b`。日志只记方法、路径、UUID与 Authorization 是否存在，不记录 token 或业务 body。

首轮 facade 收据：Root 工作区 `.scratch/mobile-implementation/m3-native-facade-receipt.json`，其中 session SHA256 为 `49c908061c6845a64322689d5b21aa0e7c26fc9d6e0547141901502f6edb4ca6`。该收据属于三项审查修复之前的冻结候选，不自动证明修复后的全部原生路径。

早期 cold flow 在30秒内失败的截图为 Expo Go 外壳下载开发 bundle，JS尚未启动。失败证据保留；最终使用已有 bootstrap 的90秒宿主就绪预算，再保持30秒业务状态谓词，通过只读 cold flow，没有重新提交生成。冷启动步骤为 stopApp → launchApp(clearState:false) → openLink。

## 原生存储拒写与恢复

在审查修复后的 A5 session 上，Root 先完成实际原生 hydrate，再将隔离模拟器的 SQLite目录改为0500、数据库文件改为0400，使新的 exclusive transaction 连接拒写。界面保留追加的中文草稿；storage error时 prepare 被拒，原冻结 key/body不变，生成POST计数仍为1。权限在 finally 中恢复为目录0700/文件0600；`retryStorage` 保存内存编辑并恢复 connected/ready，新的冷启动仍读到该编辑。实际收据是 Root 工作区 `.scratch/mobile-implementation/m3-native-storage-receipt.json`。此故障未读取或修改 SecureStore文件。

## 原生重定向反例与修复

Root 实际 Expo Go 媒体探针证伪了单靠 `new Request(..., { redirect: 'error' })` 的策略：RN whatwg-fetch Request不保留redirect，`expoFetch(request)` 默认follow。受保护源跨port302后，目标18707实际收到1次GET，Authorization未携带；UI读到26字节，不能视为FLAC。这一失败记录保留，Node Request属性检查不能证明RN行为。

随后在相同原生验证路由将调用改为 `expoFetch(request, { redirect: 'error' })`，实际流程exit0，源302带授权、目标没有新增请求，目标累计计数仍为1（仅旧失败）。对应日志为 Root 工作区 `.scratch/mobile-implementation/m3-native-redirect-explicit-init.log`；截图记录拒绝重定向后的错误状态。生产 native adapter采用相同的显式 init，M5下载调用也须显式设置；保留RN Request原有method/header/signal/body读取，不重建或消费body。

电脑B切换与实际WS header的详细归档由 Root维护。临时验证路由及故障代理不进入正式产品代码。Fake Runtime生成文件仅证明接口/原生流程，不属于真实 GPU生成证据；M4最终页面与M5播放器分别验收。
