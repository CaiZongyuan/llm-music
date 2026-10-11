# 移动端连接与数据接口

`useMobileSession()` 提供 `session` 和只读 `state`。根 Provider 先读取 SQLite，再呈现路由；AppState 后台关闭 HTTP/WS，前台先恢复 HTTP，再恢复 Job 观察。原生适配器不提供 SecureStore 或设备 token。`suspend()` 可用于可重复的 React effect 清理；`dispose()` 永久结束实例，仅用于最终释放。

业务类型来自 `@llm-music/api-client`。本地 `LocalDocument` 拥有连接索引、Creation Draft、名称草稿和持久提交意图。公开快照、草稿、意图和读取结果在运行时冻结。直连只保存稳定 server_id 与地址，不创建设备授权。

## 连接与草稿

| 方法 | 行为 |
| --- | --- |
| `hydrate()` | 读取本地状态，先 GET `/connection` 核对 SID；direct 模式无需凭据，旧 paired 索引按相同 SID 自动升级；未确认提交只 GET 原请求或 Version |
| `connect(address)` | root HTTP/HTTPS 地址；GET `/connection` 必须广告 `access_method: 'direct'`；保存 SID 与地址后进入项目。无需 PIN、名称或凭据 |
| `verify()` | 核对当前电脑 HTTP 身份；恢复原意图后再建立观察连接 |
| `getServers()` / `switchServer(serverId)` | 返回普通索引；切换 abort 旧 HTTP、关闭 WS，使用目标电脑的本地分区 |
| `retryStorage()` | 保存保留在内存中的编辑内容；初次读取未完成时重新读取，不用空数据覆盖旧记录；不自动 POST |
| `getDraft(projectId)` / `updateDraft(projectId, changes)` | 按 server/project 保存四个字符串字段；存储失败保留最新编辑，禁止新提交 |
| `getTitleDraft(target)` / `updateTitleDraft(target, value)` | 新 Project 名称按 server 保存，Version 名称按 server/project/candidate 保存；保留未提交原文本，输入不创建 intent 或 HTTP 写入 |

名称目标为 `{ kind: 'project' }` 或 `{ kind: 'version', projectId, candidateId }`。空字符串表示尚未填写或由调用者明确清空；字段保留空白及未通过提交验证的原输入。保存失败后本地编辑仍可读，`retryStorage()` 保存保留内容；准备提交仍要求存储就绪。只有明确提交操作才 trim/验证名称并创建冻结 intent。

检查 `state.hydrated`、`state.storage`、`state.connection`、`state.foreground`。`connected` 才能访问业务 API，`storage === 'ready'` 才能提交。断网和地址身份变化保留草稿/意图；同地址的新 SID 不会自动接管原电脑的分区。错误是 `MobileFailure`，含 `code`、`status` 及生成契约的 `detail`（message/recovery/resource_id）。

headless session 保留显式 `pair()` 与 credential provider 兼容旧专项测试；正式 native adapter、连接页与 direct HTTP/WS/audio 不使用该路径。即使旧 SecureStore 已丢失或不可用，广告 direct 的原电脑仍能自动恢复。

## 提交与未知结果

先 `await prepareIntent(input)`，再从显式操作 `await submitIntent(intent.id)`。`prepareGenerate(projectId)` 直接冻结当前草稿：trim 风格与歌词，seed 使用非负安全整数，空时长或0表示自动，手动时长5–360秒。

`IntentInput` 是以下 union，body 均使用生成类型：

| operation | 输入 | 恢复查询 |
| --- | --- | --- |
| `create_project` | `body: ProjectCreate` | GET `/requests/{id}`，再读取原 Project |
| `generate` | `projectId, body: GenerateCreate` | GET `/requests/{id}`，再读取原 Job |
| `retry` | `projectId, jobId`；无 body | GET `/requests/{id}`，验证 source_job_id，再读取原 Job |
| `save_version` | `projectId, body: VersionSave` | GET versions，按 candidate_id 核对实际 name/parent |

`listIntents(projectId?)` 返回当前电脑的冻结记录。`prepared` 从未获准发送；`unknown` 已落盘后开始发送，但结果尚未确认；`confirmed` 包含原 `resourceId`；`rejected` 包含明确失败，保存冲突也保留实际 Version id。

同一目标已有 prepared/unknown 时，新的 prepare 抛 `intent_pending`。重复 submit 不会开始第二个在途 POST。`recoverIntent(id)` 只读；404 保留 unknown。只有用户明确操作才调用 `replayIntent(id)`，它先查询，再沿用原 UUID key 和冻结 body。修改草稿不改变原 intent。没有自动重试、重连提交或离线 mutation 队列。

Version 保存只用服务端 Candidate 唯一性，不发送另一保存幂等键。回复未知时读取已保存 Version；GenerateFromScore/Cover 在请求父版本省略或显式 null 时，都按 Candidate 的原输入推导有效父版本。名称或有效父版本不同显示 `version_already_saved`，保留实际资源，不覆盖。`cancelJob(projectId, jobId)` 至多发送一次取消，再 GET 原 Job；界面根据真实 status/cancel_requested 表示终态或确认中。

## 读取与观察

`getProjects/getProject/getJobs/getJob/getCandidates/getCandidate/getVersions/getVersion/getAsset` 返回生成类型。直连 HTTP 使用绝对地址，不带 Authorization；保留同源保护、redirect:error 与覆盖响应读取的10秒超时。切换会话后旧结果不能写入新快照。

`queries.ts` 提供对应 `useProjects/useProject/useJobs/useJob/useCandidates/useCandidate/useVersions/useVersion`，缓存键含 server/device。四状态由页面呈现：`data === undefined` 是初始、前提或失败状态；只有成功返回 `[]` 才是空。刷新失败继续显示已有 data，并呈现错误及明确重试入口。

`watchJob(projectId, jobId, { job, error })` 返回取消订阅函数。先 HTTP 读取 Job，再打开所选电脑的 WS URL，不带设备凭据。通知触发 HTTP 核对；HTTP 读取期间的新通知不会丢失。终态关闭只结束这一观察，不把整台电脑标记离线。异常关闭最多补一次 HTTP；再次连接通过明确验证或前台恢复。

## M5 原始音频连接

`await authorizeMedia(projectId, assetId)` 在 direct 模式检查 `/connection` 与 Asset 归属，只接受 audio Asset，不查询 `/device`。返回的 opaque lease 含 `epoch/serverId/projectId/assetId`、`isCurrent()` 和 `createRequest(signal?)`；direct lease 没有 deviceId。

`createRequest()` 只生成当前电脑的 canonical Asset content URL，不带 Authorization。epoch、连接或前台状态失效后不能再创建 Request。RN 的 Request polyfill 不保留 redirect 选项，M5 必须在实际 `expo/fetch` 调用的第二个参数中显式设置 `redirect: 'error'`，不能只依赖 Request 属性。原生 JSON adapter 也显式传入该 init。

以下代码位于持有 session、projectId、assetId 与下载 AbortController 的 M5 调用方法中：

```ts
import { fetch as expoFetch } from 'expo/fetch';

const lease = await session.authorizeMedia(projectId, assetId);
const response = await expoFetch(lease.createRequest(controller.signal), {
  redirect: 'error',
});
```

M5 检查响应与 lease 是否仍有效，受控下载原始 FLAC，清理失败下载，再把本地缓存交给播放器；下载、暂停、seek 和释放由 M5 拥有。每次播放/seek 前重新调用 `authorizeMedia`，缓存与终态 WS 不能替代电脑身份和当前连接检查。

## 验证

仓库根目录：

```powershell
pnpm --filter @llm-music/api-client build
pnpm --filter @llm-music/mobile test
pnpm --filter @llm-music/mobile check:test
pnpm mobile:check
pnpm --filter @llm-music/mobile exec expo install --check
```

Node 测试在公开 session 接口注入存储、随机数、HTTP/WS 外部 provider，验证直连、旧索引升级、无凭据 cold 恢复、未知结果、冻结输入、存储失败、前后台与电脑隔离；这不等于原生磁盘故障证据。历史 Expo Go 连接证据见 [客户端核验记录](../../../../docs/verification/mobile-client-core.md)；新版地址直连仍需单独 native 验证，生产界面没有模拟控制或故障开关。
