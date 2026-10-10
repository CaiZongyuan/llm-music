# Android 交付核验（M6）

日期：2026-10-11。父规格：[SPEC-017 / #99](https://github.com/CaiZongyuan/llm-music/issues/99)，验收票据：[#105](https://github.com/CaiZongyuan/llm-music/issues/105)。本页是内部维护证据，不登记为公开 Starlight 页面。界面沿用[已确认预览](../ui/mobile-workbench-preview.md)，架构与阶段遵循[产品规划](../production.md)。

独立 APK 已在 Windows Android Emulator 中完成配对、真实 GPU 生成、原始 FLAC 试听、明确命名保存和版本历史。最新本地探针也恢复了同一个 GPU Project 的冷启动入口。**最终云 APK、源码检查、GitHub Release 和物理 Android 仍待验收；#105 尚未完成。** 本次实际设备只有 `emulator-5562`，没有 WSL 或 Android 物理真机执行证据。

## 源码、构建与二进制

交付工作树为 `D:/Projects/Backend/llm-music-worktrees/mobile-android-delivery`。M5 的 [PR #111](https://github.com/CaiZongyuan/llm-music/pull/111) 实际集成至 `7d21d9a2137caaa6fbbe9bab1fc64f6bb9131456`；M4 的 [PR #110](https://github.com/CaiZongyuan/llm-music/pull/110) 实际合并至 `a842aedd84220957dd03d0562bc25234c7229d95`，#103/#104 已关闭。最终 M4 CI 在具体失败 job 的有界重跑后通过；保留初次失败，未将初次运行描述为全绿。

| 样本 | 源码 / 执行身份 | 实际范围 |
| --- | --- | --- |
| 本地完整 APK E293 | `e29329008d16db9532283acb5bf8674688b3c0d8`；73,877,810 bytes；SHA-256 `eb448fcb30f1edf61e0224c02dcde7ed8645ef18fc24705d2cc8ab073b02bf47` | 安装后完成独立配对、SecureStore 冷启动、Fake 正常流程与后台暂停。历史路径 `D:/m/sg/apps/mobile/android/app/build/outputs/apk/release/app-release.apk` 已被后续构建覆盖，不能再从该路径取得 E293 字节。 |
| 云 APK E2 | `e2fad9b9c1a4fd8b2dda868c50f995713ab8792b`；[Actions run 38067329953](https://github.com/CaiZongyuan/llm-music/actions/runs/38067329953) `SUCCESS` | 官方 CLI 以明确 numeric build ID `38067329953` 下载；源码收据、校验和、Manifest 和 signer 已核对。安装、冷启动、撤销自己创建的 Fake 设备、真实 GPU LAN 配对与生成试听已执行。 |
| Expo Go 正常流程 | runner checkout `78fc44c3b08f4a5805f0adebc79d0c5213d81fd5`；Go `host.exp.exponent` 57.0.9 / code 444 | 完整 Fake 流程及后台检查通过；Go 的二进制身份不能代替本项目 Manifest 与签名验收。 |
| 本地 library 探针 | `ef727d5aeaae2ec3f115f1d84007ed2229078ea2` | 仅对 library FlatList 取消 native subtree clipping。实际冷启动恢复原 GPU Project/Version、中文草稿、不自动播放、明确点击后原音频播放均通过。最终云构建尚待核对，不能称为已发布产物。 |

E2 留存于原工作区 `.scratch/mobile-implementation/rnd-e2-final/`：

- `source.json`：记录上述完整源码 SHA、run、preview profile、Node `24.18.0`、pnpm `11.22.0`。
- `shengjian-mobile-preview.apk`：**73,877,723 bytes**，SHA-256 **`07f12be9ea2f0f003bb34e258dfa104847863dfe54b0b1cb291238f9a04741a9`**，与 `SHA256SUMS.txt` 一致。
- 实际 signer certificate SHA-256：`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`。Root 两次读取 `apksigner verify --print-certs` 核对；当前 signer 为 Expo 生成的 debug key，用于 internal APK。
- App ID `com.shengjian.mobile`，version `1.0.0` / code `1`，minSdk `24`，targetSdk `36`。实际 Manifest 的 LAN cleartext 与前台音频配置单独核对；独立 APK 启动与运行不依赖 Metro。

`assembleRelease` 是 Gradle 构建任务名；它不代表已经建立正式发行签名或创建 GitHub Release。构建 push 只执行配置检查，实际编译由 workflow dispatch 触发。`rnd --wait --json` 曾 exit 0 但返回 `IN_QUEUE`，只能证明已发起任务；本页的 E2 成功来自对应 Actions run、已下载字节和设备操作。

## Fake 与 Expo Go 正常流程

公共入口是 `scripts/test-mobile-workflow.ps1` 与 `apps/mobile/.maestro/workflow.yaml`，**仅用于调用者已配对的隔离 Fake Runtime**。独立 APK 与 Go 都在 UI 创建 Project，填写中文 style/完整多行 lyrics，以 seed 42、max_seconds 35 生成，试听、seek、明确命名保存，再从版本历史打开；`-CheckBackground` 检查退到后台后暂停，回到前台不自动播放。

| 执行 | Maestro 结果 | 持久对象与来源 |
| --- | --- | --- |
| E293 APK；runner checkout E2 | 1 flow，1m52（testcase 112.153 秒），terminal exit 0；后台检查通过 | Project `458ee5e8-c716-4369-84d5-9d2ee31b31ec`；Project/Job/Candidate/Version 各 1，完整输入与冻结记录一致。 |
| Go；runner checkout 78fc44c | 1 flow，2m31（testcase 150.775 秒），terminal exit 0；后台检查通过 | Project `423550bf-8e60-4af6-bb81-11cf61611e3a`；Project/Job/Candidate/Version 各 1，完整输入与冻结记录一致。 |

两次均使用 Fake namespace `7d474c10-d26a-40f0-b8db-9f7c7a0a9888`；owner 地址为 `http://127.0.0.1:18700`，APK 配对 LAN `http://192.168.31.209:18701`，Go 配对故障代理 LAN `http://192.168.31.209:18708`。Fake 音频 467,960 bytes、约 34.999 秒，不能用来证明 YuE2 或 GPU 推理。

公共 runner 的完整 SHA-256 为 `6770e546e77a4cce33be712fd9ecd088ac26b39f8f698f26da15f70e48cea5bc`。APK flow SHA 为 `d62706a076257ae2cb0601eb68d9f4c34c63f0225e38062da4a2c5ef701e687c`；Go flow SHA 为 `8a22101d22cb985f9e3236f01a87d3cab6e2e163a53d712bdd4bb0c2e107381f`。上述用时来自 flow 结果，runner 起止时间还包含准备与收据写入。

原工作区收据为 `m6-apk-public-workflow-receipt.json` 和 `m6-go-public-workflow-receipt.json`。delivery 的原始 runner 证据分别在 `.scratch/mobile-workflow/maestro-20261011-002801-391-ea2e6786/` 与 `maestro-20261011-003932-442-d6e84638/`，含 `receipt.json`、`junit.xml` 和 Maestro 操作记录。

## 真实 GPU 与原始音频

真实 GPU 证据使用 E2 APK、隔离 namespace `aa8adce4-b293-49ec-978b-51b2ef38fe30`、owner API `18720`、LAN API `18721`。producer 为实际 ComfyUI / YuE2 / RTX 3070 Ti 8GB。

推理前 `2026-10-10T16:52:57.309223Z` 重新采集当前绑定，核对 PID `38172`、进程创建时间与入口、clean pinned source、全量模型 SHA 和 readiness。ComfyUI revision `7a5dad695fe1cae25efcb2550530fb20ef68da3d`；plugin revision `fc78df9dfb214f396aa281f5b03519cefff5b00a`。YuE2 与 SheetSage2 的 revision 均为 `2f76ca75e6ee094169de899cc7fc99d6887e2196`；实际文件 SHA 分别为 `33765adbf9813c9a50318218760b2fd819a319862460a04884607581961c6fee` 与 `5fd960ce3df281e3f3a889d174584d88f96247711480cf96377b12d7e8b6adc5`。`binding_verified`、reachable、ready 均为 true；这不是沿用历史进程或 Fake 健康信息。

UI 只点击 **1 次 Generate**，输入由 `m6-gpu-run-input.json` 与 API 回读共同冻结：

```json
{
  "style": "独立流行，温暖女声，轻快鼓点",
  "lyrics": "[Verse]\n末班车穿过雨后的街\n霓虹在车窗慢慢重叠\n[Chorus]\n把没说的话唱成明天",
  "seed": 42,
  "max_seconds": 40
}
```

| 对象 | 实际 ID / 状态 |
| --- | --- |
| Project | `786f219b-4df9-4793-9937-880f05cffde1`，名称 `手机 GPU 验证 20261011-005347` |
| Job | `3e934792-0ba2-4601-bd7e-6eea8563dfab`，Generate / completed |
| Candidate | `a5392ebf-6a82-41c8-a92a-a3a38cba6a12` |
| 原始 audio Asset | `1d832756-e601-4273-a78b-8f723e01c668` |
| 明确保存的 Version | `27207089-211d-4a20-9d1c-3094987cbdeb`，名称 `雨后 · GPU 验证 20261011-005347` |

Job 的持久时间从 `2026-10-10T16:55:28.224847Z` 到 `16:57:00.008851Z`，跨度 **91.784004 秒**。运行观察约 90 秒；数据库时间跨度包含任务生命周期，不能将它当作纯模型计算性能。Version 于 `17:03:51.218700Z` 保存，仍引用同一个 Job/Candidate/audio。

owner 下载全量原始文件并在 CPU 解码：3,520,198 bytes，SHA-256 `17c8b10eca024c62a04b25c6dbfb4f93e5f92e8b069e6e7bb0b93e6bb526468b`，FLAC MIME 与签名正确，stereo / 48kHz / PCM16，1,919,936 samples，实际时长 39.998666666666665 秒；RMS 0.12381820554908306，peak 0.92340087890625。该检查证明原始全量字节可解码；Android 播放由独立原生 UI 证据证明。

E2 原生 UI 通过播放、暂停、从 0 试听、seek 至 10 秒，以及实际 slider 拖动到 31–33 秒。主 GPU flow 在已输入 Version 名称后，`hideKeyboard` 返回 library，找不到 save 元素而失败；已输入名称仍持久化。`m6-cloud-gpu-save-remainder.log` 继续原 Candidate，明确点击保存并打开历史与详情，**没有再次 Generate**。该失败和续跑必须一起保留。

E2 随后冷启动时只能看到原 GPU 项目标题，row 很小，open button 没有 Compose view；`m6-cloud-gpu-cold-restore.log` 保留该失败。`ef727d5` 本地探针的 `m6-unclipped-gpu-cold-restore.log` 已实际通过：停止并启动同一个 App，打开上述 Project，核对完整中文 style/lyrics，打开上述 Version，确认无自动播放，再明确点击播放原始 39 秒音频。该结果支持 library clipping 修复；最终云 APK 是否包含并保留这个结果仍需单独核验。

原始 GPU 收据均在 `D:/Projects/Backend/llm-music/.scratch/mobile-implementation/`：`gpu-launcher/runtime-evidence-8188.json`、`m6-gpu-before-submit-health.json`、`m6-gpu-run-input.json`、`m6-gpu-api-receipt.json`、`m6-gpu-byte-decode-receipt.json`，以及上述 Maestro log 和截图目录。本页不记录永久 token、PIN 或 launcher session 的停止凭据。

## 保留的失败与修复边界

| 失败 | 已查明的边界 / 后续结果 |
| --- | --- |
| PowerShell 5 Metro 字节响应 | 是启动检测处理问题；不能据此宣称产品页面失败或成功。 |
| 空 lyrics 执行 `eraseText: 10000` | 设备 RPC 超过 120 秒，未到 Generate；原 Project 无 Job。 |
| Go `HomeActivity` 与 `ExperienceActivity` | Go launcher 和 App experience 的识别不同，需要正确启动目标。 |
| 回前台提示可见，但 play action 在屏幕下方 | 78fc44c 改为滚动至实际 play action；随后 Go 完整公共流程通过。 |
| standalone Compose width `379.428…` | 实际 native 类型转换崩溃。仅取整后 `379.0` 仍崩溃，反证 rounding-only 修复。 |
| RN Host 边界修复 | connection-only 8b7533a 探针存活；all-Host E293 探针存活并完成原生 Fake 流程。保留 `m6-apk-integer-width-red.json`、`m6-apk-integer-width-retest-failed.json` 和两个 Host probe 收据。 |
| GPU 命名后返回 library | 主 flow 失败；继续同一 Candidate 的保存与历史通过。没有新增生成。 |
| E2 原 GPU row 冷启动不可打开 | 本地 ef727d5 取消 row clipping 后恢复通过；最终云 artifact 待验。 |

日志未能证明原因的失败继续记为 unknown；不能从后续通过倒推出早期失败已由某项产品修复解释。公共 Fake runner、原始音频字节、slider 拖动、真实 GPU、物理设备分别提供证据，任一项不能代替其他项。

## 原工作区同步与缓存

Root 依据 task-owned 清单同步至原工作区，`workspace-sync-receipt.json` 记录 169 个路径：128 copied、41 identical。同步前不同的 owned 文件保存在 `.scratch/mobile-implementation/workspace-owned-before-sync/`；43 个 unrelated Web dirty 路径按 SHA 保留，没有从 delivery 覆盖或删除。

Root 停止 Metro 后离线刷新旧 typed-route 缓存，应用与测试 TypeScript 通过。后续原工作区 style-token 检查发现新增配对 CSS 与该工作区既有 Acid token 不一致，Root 仅适配本任务 owned 的配对 CSS；style 3/3、Vite 构建与最终 Web TypeScript 均通过。真实浏览器对原工作区的 settings 配对面板完成地址显示、设备状态与重新读取操作检查，截图 `m6-root-pairing-panel.png` 留在隔离证据目录。同步收据描述其采集时点，不能作为后续源码自动一致的证明；其后仅追加已验证的 library 单行修复及 owned CSS 对现有 token 的适配。

## 复用入口

日常 Expo Go 开发从仓库根目录运行；手机与电脑处于同一 LAN：

```powershell
pnpm --filter @llm-music/api-client build
pnpm mobile:dev --lan --port 18081
```

Go 扫描 Metro 二维码或加载 `exp://<电脑 Wi-Fi IPv4>:18081`；App 的 `/connect` 另填 FastAPI LAN HTTP 地址及电脑 UI 显示的配对码。两者是不同服务。仅模拟器 loopback 开发可用 `pnpm mobile:android --localhost --port 18081`。本次实际运行使用 Windows Android Emulator；不把这些结果写为 WSL 已验证。

已在目标 App 中配对到隔离 Fake Runtime 后，从根目录执行；替换地址和隔离数据库 `server_id`：

```powershell
./scripts/test-mobile-workflow.ps1 -Device emulator-5562 -AppId host.exp.exponent `
  -ExpoUrl 'exp://<电脑IPv4>:18081' -FakeApiUrl 'http://127.0.0.1:18700' `
  -PairedApiUrl 'http://<电脑IPv4>:18701' -ExpectedServerId '<server_id>' `
  -Paired -Isolated -CheckBackground
```

独立 APK 改用 `-AppMode Apk -AppId com.shengjian.mobile` 并省略 `-ExpoUrl`。该入口不读取 PIN 或 token，不为调用者启动 API，不可指向真实 GPU。实际 GPU 本次由 Root 单独控制，避免公共 Fake 流程重复提交昂贵推理。

云构建使用固定 `@react-native-feel/deploy@0.3.0`、`apps/mobile/eas.json` 与根 `.github/workflows/eas-build.yml`。**CLI 实际工作目录必须为 `apps/mobile`**；本机 `pnpm --dir apps/mobile dlx ...` 曾没有改变 CLI cwd。GitHub 凭据只传给子进程环境，不写配置或收据。以下是复用命令，重新执行会发起新云构建：

```powershell
Push-Location apps/mobile
try {
  pnpm dlx @react-native-feel/deploy@0.3.0 config --platform android --profile preview --json
  pnpm dlx @react-native-feel/deploy@0.3.0 build --platform android --profile preview --wait --non-interactive
  pnpm dlx @react-native-feel/deploy@0.3.0 build:list --platform android --limit 5 --json
  # 将 38067329953 替换为实际成功 run 的 numeric build ID。
  pnpm dlx @react-native-feel/deploy@0.3.0 build:download --build-id 38067329953 --all-artifacts --non-interactive
} finally { Pop-Location }
```

不要用 latest/platform 自动挑选：CLI 也会列出 configuration-only run。不要把 dispatch UUID 当作 numeric build ID。官方下载、原始 checksum、源 SHA、Manifest、signer 与实际安装必须对应同一 artifact。

Windows 本地构建只在 disposable 短路径工作树执行；hoisted node linker 只用于执行副本，不修改原 workspace 的锁文件或全局 pnpm 配置。本次短路径为 `D:/m/sg`；详细工具边界见[部署调查](../research/mobile-react-native-deploy-facts.md)。

## 尚未完成

1. 最终云 APK：包含 library 修复的明确源码 SHA、成功 run、官方 numeric ID 下载、原始字节、Manifest 和 signer。
2. 最终 artifact 安装后的 cold 恢复、原 Project/Version 回放，以及源码/行为检查；本地 probe 的通过不代替最终 artifact。
3. 原工作区后续适配的最终检查与精确源码对应关系。
4. GitHub Release：尚未创建。发布须使用实际验收过的同一份 APK 字节并明确关联源码 SHA。
5. 至少一台物理 Android 的实际操作验证；当前没有该设备证据，#105 继续开放。
