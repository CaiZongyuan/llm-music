# React Native Deploy：Windows、Expo 57 与 APK 分发核查

核查日期：2026-10-10。本文是部署工具调查记录，不是已完成的构建或发布报告。本次读取官方网页、文档、npm 固定版本发布包及仓库配置，没有安装或执行 `rnd`，没有上传凭据、触发远程构建或创建 GitHub Release。

后续本机试运行已单独完成：Windows Node 24.18.0 / pnpm 11.22.0 执行固定 `pnpm dlx @react-native-feel/deploy@0.3.0 project:info` 与 Android preview `config --json`，均 exit 0。CLI 读到 `apps/mobile` 的应用配置和 Git 分支，确实把根工作区锁文件报告为 none；已用显式 pnpm profile 与根安装步骤适配。它把已有但未提交的 prebuild 目录也称为 bare，不能用这条显示判断 native 目录已提交。第一次直接运行仅解包的 JS 因未安装外部 `joi` 而失败；完整 dlx 安装后通过，没有改项目依赖或锁文件。

Root 的适配准备文件为 `.github/workflows/eas-build.yml` 和 `apps/mobile/eas.json`：Node/pnpm/JDK 固定，Android-only/internal preview，profile 的 `withoutCredentials: true` 避免首次试构建索取 release keystore；APK 暂用 Expo 生成的 debug signer。源码与归档路径对齐 mobile 工作区，checkout 绑定实际 dispatch 的 `github.sha`，构建产物附源码和 SHA256。独立 Standards/Spec 复核无阻塞；目前尚未触发该 APK 工作流或创建 Release。

已用既有 mobile-client 工作流做一次真实非主分支 dispatch，GitHub API 返回成功；该工作流当前不存在于 main，因此不以“必须先把所有 mobile 源码合入 main”的推测阻止已证实的分支路径。新 APK 工作流的 push 只检查配置并登记工作流，编译只在明确 dispatch 时运行。官方 0.3.0 会把该轻量配置 run 也列成 Android build；本轮必须使用明确的 `--build-id` 下载，不使用 latest/platform 自动挑选。校验和在 build 目录内生成，与解压后的 APK 同目录。

后续完整源码首次真实 dispatch：2026-10-10T15:37:02Z，源码 `52917aa024833cdeea00fe4fd68601c64500a3ce`，[Actions run 38064332565](https://github.com/CaiZongyuan/llm-music/actions/runs/38064332565)，CLI build ID `01299f88-58c7-4743-8e07-cde294e2c36b`。GitHub 凭据仅通过子进程环境传递。`--wait --non-interactive --json` 实际 exit 0 但返回 `IN_QUEUE`，所以该退出状态只证明启动，编译、下载及安装必须继续核对。Windows 本次 `pnpm --dir apps/mobile dlx ... build` 未改变 CLI 的工作目录，报找不到 eas.json；改为先进入 `apps/mobile` 后调用 `pnpm dlx` 才成功，不靠重新生成配置解决。

## 结论与建议

可以把 React Native Deploy 作为 Android GitHub Actions 构建入口试用。它编译独立 APK；日常继续使用 Expo Go。当前 `@react-native-feel/deploy@0.3.0` 的默认模板假定应用就在仓库根目录，**不能直接套用本仓库的 `apps/mobile` pnpm 工作区**。先调整工作流，再用明确的 Android `preview` profile 构建，最后把同一份已验证 APK 放到 GitHub Releases。无需为此部署 Cloudflare 安装服务。[构建行为][building]、[固定版本模板][template]

此工具的 `--local` 明确被拒绝。Windows 电脑负责运行 Node CLI、发起任务和下载产物，Android 编译发生在 GitHub 的 Ubuntu runner；它不会修复 Windows 本地 Gradle/Ninja 的路径问题。[差异说明][differences]、[固定版本 CLI][cli]

## 固定版本与来源

- 官网入口：https://reactnativefeel.com/deploy 。官网指向以下官方文档和 npm 包。
- npm 查询结果：`@react-native-feel/deploy@0.3.0`，可执行文件 `rnd`，Node 要求 `>=20`。[版本元数据][registry]
- 发布包包含 `dist/bin/rnd.js`、`templates/eas-build.yml`、`README.md` 和 `package.json`。本次直接下载并读取文件，没有运行包内代码。[固定版本 tarball][tarball]
- 元数据中的源码仓库为 `https://github.com/bidah/react-native-deploy`；本次 GitHub API 对该仓库返回 404，不能据此判断是私有、改名还是暂不可用。因此源码结论来自 npm 的固定发布包。
- 下列 unpkg 固定版本文件与下载的 npm tarball 对应文件逐字节相同；SHA-256 如下。在线官方文档是可变页面，与固定版本源码出现差异时，本文按实际执行的发布包判断。

| 文件 | SHA-256 |
| --- | --- |
| [dist/bin/rnd.js][cli] | `2d99baa5a0bb4f628e28706272b2027f458620068ddfef84323e97c9cf132466` |
| [templates/eas-build.yml][template] | `69bf6bc354a50fc9a068cd1089bad7554761b5c7baae41c37c6f9ee9b436b07d` |
| [README.md][readme] | `7fbb405459d28aed7f0e8c5cb5333beef8bfc9b6c66320800ed4abe4b324e8b6` |

## 产物、Windows 与 Expo Go 的边界

| 问题 | 核查结果 |
| --- | --- |
| 是否产出独立 Android APK？ | `distribution: "internal"` 默认执行 `:app:assembleRelease`；明确 `android.buildType: "apk"` 同样选 release APK。[building] |
| 默认 production 是否直接可安装？ | 默认 store profile 产出 AAB；手机不能直接安装 AAB。[building] |
| 是否是 JS OTA？ | 不是。`rnd update` 被识别后拒绝，源码说明 OTA 需要独立更新服务器。`channel` 等字段被解析不代表已提供 OTA。[differences]、[CLI][cli] |
| 是否仍依赖 Metro？ | release APK 是独立应用；development profile 使用 Debug/assembleDebug，并按官方教程安装 `expo-dev-client`、连接 Metro。当前目标选 release preview，无需增加 dev-client。[building]、[getting-started] |
| Windows 是否能启动构建？ | CLI 是 Node 程序，使用 Node 文件系统/路径 API、`git` 与 GitHub HTTP API，包中未发现 Windows 排除条件；发起云构建在设计上可行。本次未在 Windows 执行 CLI，不能称为实测通过。[registry]、[CLI][cli] |
| Windows 本地构建是否支持？ | `rnd build --local` 明确拒绝；Android runner 默认 `ubuntu-latest`。[differences]、[building] |
| 是否需要替换 Expo Go 日常开发？ | 不需要。APK 用于本项目应用标识、原生权限和 Manifest 验收；Expo Go 自带的二进制不能应用本项目 config plugin。[Expo Go 边界][expo-go] |
| Expo SDK 57 是否已由此工具验证？ | 工具委托项目自己的 Expo prebuild 与 Gradle，不固定 Expo SDK。未找到该发布版本针对本项目 SDK 57 的实际构建证据；需以新工作流的一次完整构建确认。[template] |

仓库核查基线为 Android foundation 提交 `fe29e5455a2313157b4f3a41e579ec01f97797e4`：`apps/mobile` 使用 Expo `~57.0.27`、React Native `0.86.3`、静态 `app.json` 和 `com.shengjian.mobile`。根 `package.json` 固定 `pnpm@11.22.0`。本次目录内没有提交的 `android/` 或 `ios/`，属于由 prebuild 生成原生工程的路径。这些是当前源码配置，不是 React Native Deploy 构建通过的证据。

## 账号、签名与分发

Android APK 试构建需要 GitHub 仓库、可运行的 Actions 工作流以及具备相应仓库/Actions 权限的 GitHub 凭据；不需要 Expo 账号。官方教程使用带 `repo`、`workflow` scopes 的 GitHub token。CLI 可以从进程环境读取 `EAS_GITHUB_TOKEN`、`GH_TOKEN` 或 `GITHUB_TOKEN`；不会自动读取 `gh` 的登录文件。调用方可在内存中取得已有 `gh` 凭据并仅传给子进程，不要打印 token。[getting-started]、[CLI][cli]

| 情形 | 所需额外配置 |
| --- | --- |
| 初次 Android sideload 试构建 | 官方说明没有 release keystore 时用 debug key；不需要 Google Play 账号或设备 UDID。实际签名仍须检查 APK。[credentials]、[internal-distribution] |
| 后续稳定的 Android 安装更新/正式发行 | 保留并备份固定 keystore，配置 `EAS_ANDROID_KEYSTORE`、`EAS_ANDROID_STORE_PASSWORD`、`EAS_ANDROID_KEY_ALIAS`、`EAS_ANDROID_KEY_PASSWORD`。模板通过 Gradle injected signing properties 使用它。[credentials]、[template] |
| GitHub Release 下载 | 独立于 `rnd build` 的后续步骤；GitHub CLI 可以把本地 APK 作为 Release asset 上传。[GitHub CLI Release 文档][release] |
| 官方自托管二维码安装页 | 可选 Cloudflare Worker/R2，仓库变量 `EAS_INSTALL_URL` 与 secret `EAS_INSTALL_TOKEN`；不配置时只保留 Actions artifact。本项目选择 GitHub Releases 时无需启用。[internal-distribution] |
| iOS 真机/TestFlight | 需要 Apple 侧签名、provisioning profile 和 App Store Connect 相关配置；本阶段仅验收 Android，不扩展到这条流程。[credentials] |

Actions 的 `application-archive` 保留期为 90 天。它是待下载的 ZIP artifact，不是自动创建的 GitHub Release。GitHub Release 发布时必须明确绑定已验证源码 SHA，避免默认把 tag 指向当时主分支的另一提交。[workflow]、[release]

同 package 的安装更新还要求签名证书一致。初次试构建如果使用 debug key，不能把“APK 生成成功”当成已经建立长期 release 签名策略；比较新旧 APK 的实际证书后，再确定是否可以原位升级。当前 LAN 凭据保存在 app 私有数据中，验收时也要覆盖升级与重启后的恢复。这是本项目下一步验收要求，不是本次已验证行为。

## 本仓库必须调整的地方

以下结论直接来自固定版 CLI 的 `An`、`In`、`T`、`Tn`、`Dt` 及工作流模板。

| 默认行为 | 对本仓库的影响 | 适配要求 |
| --- | --- | --- |
| CLI 以当前目录向上遇到的第一个 `package.json` 为 project root | 从 `apps/mobile` 执行只检查该目录的 lockfile，看不到根 `pnpm-lock.yaml`；未设置 profile 的 `pnpm` 时会选择 `npm` | CLI 在 `apps/mobile` 读取 `eas.json`，profile 显式选 pnpm；runner 仍在仓库根安装依赖 |
| `build:configure` 写 `<projectRoot>/.github/workflows/eas-build.yml` | 从 mobile 执行会写入 `apps/mobile/.github/workflows`，GitHub 不按根工作流发现它 | 手动把受控工作流放根 `.github/workflows/eas-build.yml`，不直接运行默认 configure 后就 dispatch |
| runner 在 checkout 根读取 `eas.json` | 根没有 mobile 的 profile | 修改 Read eas.json 步骤指向 `apps/mobile/eas.json` |
| prebuild 在根执行，Android build 执行 `cd android` | 读错 app config 和原生目录 | prebuild 在 `apps/mobile` 运行；Gradle 在 `apps/mobile/android` 运行 |
| artifact 收集 `android/app/build/outputs` | 找不到 mobile APK | 收集 `apps/mobile/android/app/build/outputs`，保持最终 `application-archive` 名称让 CLI 可下载 |
| package-manager 字段只传名称；模板 `npm install -g pnpm` | profile 的 `pnpm` 版本虽被解析，但没有用于固定实际安装版本 | 工作流显式安装 `pnpm@11.22.0`，核对 `pnpm --version`；Node 同样显式固定当前验证版本 |
| 只安装 JS dependencies | `@llm-music/api-client` 导出的是 `dist/src/index.js`，生成文件没有随源码提交 | 在根安装后执行 `pnpm --filter @llm-music/api-client build`，再 prebuild/打包 |
| 支持任意 profile/平台 | 默认 `--platform all` 还会触发 iOS 构建 | 本次始终指定 `--platform android --profile preview` |

保持原 config plugin、`com.shengjian.mobile` 与前台试听配置进入 prebuild；不要为适配工作流删除 LAN cleartext 声明或重新启用麦克风/背景播放。最终验收读取新 APK 的 merged Manifest，不能只核对 app.json。

工作流的 dispatch inputs 和 `run-name` 中的 `[eas:dispatch_id=…;platform=…;profile=…;distribution=…;simulator=…]` 标记需要保留，CLI 通过它关联自己发起的 run。CLI 固定访问 `eas-build.yml`；改名要同时处理 CLI 的发现逻辑。[how-it-works]、[CLI][cli]

## 下一步命令与成功标准

先完成上面的工作流适配、独立审查和推送。以下为复用命令；实际执行范围以本文记录和对应构建报告为准。CLI 在最终整合工作树的 `apps/mobile` 目录运行；本地环境按现有 pnpm 和 Node 版本使用。

可用的 `apps/mobile/eas.json` preview 方向：

```json
{
  "cli": { "version": ">= 5.2.0", "appVersionSource": "local" },
  "build": {
    "preview": {
      "node": "24.18.0",
      "pnpm": "11.22.0",
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

该 `pnpm` 字段确保 CLI 选择 pnpm；版本固定由已适配工作流保证。不要依靠 `autoIncrement`：官方说明它目前只是读取，runner 不实施，需要直接维护 `app.json` 中的版本号。[building]、[differences]

```powershell
Push-Location apps/mobile
try {
# 只读核对配置；尚未发起构建。
pnpm dlx @react-native-feel/deploy@0.3.0 project:info
pnpm dlx @react-native-feel/deploy@0.3.0 config --platform android --profile preview --json

# 在工作流/源码已推送、GitHub 凭据仅传给子进程后，Root 负责执行。
pnpm dlx @react-native-feel/deploy@0.3.0 build --platform android --profile preview --wait --non-interactive
pnpm dlx @react-native-feel/deploy@0.3.0 build:list --platform android --limit 5 --json
pnpm dlx @react-native-feel/deploy@0.3.0 build:download --build-id <BUILD_ID> --all-artifacts --non-interactive
} finally { Pop-Location }
```

成功必须同时满足：

1. CLI 发起的 Actions run 绑定预期 SHA，工作流使用固定 Node/pnpm，实际完成根工作区安装、共享 client build、mobile prebuild 和 `assembleRelease`。
2. 下载到非空 APK；记录 SHA-256、实际 signer 与 merged Manifest。package 为 `com.shengjian.mobile`，LAN cleartext 可用，没有录音/背景音频权限与服务的回归。
3. 关闭 Metro 后，该 APK 在 Android 模拟器和至少一台真机启动；用 LAN 配对、生成、原始 FLAC 播放/暂停/seek、明确保存 Version 验证最终整合代码。Fake Runtime 与真实 GPU 证据分别记录。
4. 发布到 GitHub Release 的 APK 字节与已验证 APK 完全相同；Release 明确对应源码 SHA，附实际校验和、签名及验证范围。首次试构建不能被描述为完整 M6/GPU 验收。

## 来源

[registry]: https://registry.npmjs.org/@react-native-feel/deploy/0.3.0
[tarball]: https://registry.npmjs.org/@react-native-feel/deploy/-/deploy-0.3.0.tgz
[cli]: https://unpkg.com/@react-native-feel/deploy@0.3.0/dist/bin/rnd.js
[template]: https://unpkg.com/@react-native-feel/deploy@0.3.0/templates/eas-build.yml
[readme]: https://unpkg.com/@react-native-feel/deploy@0.3.0/README.md
[getting-started]: https://react-native-deploy.pages.dev/deploy/docs/guide/getting-started
[building]: https://react-native-deploy.pages.dev/deploy/docs/guide/building
[differences]: https://react-native-deploy.pages.dev/deploy/docs/guide/differences
[credentials]: https://react-native-deploy.pages.dev/deploy/docs/guide/credentials
[internal-distribution]: https://react-native-deploy.pages.dev/deploy/docs/guide/internal-distribution
[workflow]: https://react-native-deploy.pages.dev/deploy/docs/reference/workflow
[how-it-works]: https://react-native-deploy.pages.dev/deploy/docs/guide/how-it-works
[expo-go]: https://docs.expo.dev/develop/development-builds/faq/
[release]: https://cli.github.com/manual/gh_release_create
