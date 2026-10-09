# #46 Version 分支与 A/B 预览记录

- 票据：[#46](https://github.com/CaiZongyuan/llm-music/issues/46)，父规格 [#11](https://github.com/CaiZongyuan/llm-music/issues/11)，关联 #6。
- 实际基线：`4763a55c238f4345700977e16b4325e0c2b42532`，#45 / PR #91 已 merge、#45 CLOSED，Root 已验证真实 P4 gate；领取前读回原生 blocker 已关闭、无旧 owner。
- Owner：`/root/version_preview_developer`；branch `p5/46-version-preview`；worktree `.worktrees/46-version-preview`。[实际领取评论](https://github.com/CaiZongyuan/llm-music/issues/46#issuecomment-6065696749)。
- 预览：[version-compare-v1](https://github.com/CaiZongyuan/llm-music/blob/aec081f8e5254a9dc1f7ba4b606ffd7211add679/docs/previews/version-compare-v1/README.md)，<http://127.0.0.1:18096/llm-music/version-preview/>。
- 冻结源码：`343c57f904c625293ffffad2f57bcac33e39a1fc`。完整交接文档 head 及 served/source/media hashes 由 Root owned `.scratch/p5-development/46-preview/freeze.json` 读回，不用后续文档提交冒充重新运行完整浏览器。
- 状态：预览实现和作者实际验证完成，交 Root 非作者 Standards/Spec、独立浏览器检查与实际集成。未领取 #47/#48；未将本票模拟保存写成正式持久 API 验收。

## 用户授权与沿用体验

用户针对最终 #43 Cover 预览回答“可以”，随后明确：“后续不用我确认了，你快速开发玩吧”。原始授权保留在 [#43 记录](43-cover-preview.md:13)。本票沿用该豁免，不新增确认问题、不等待新确认、不伪造新的确认原话；预览、验证、纠正与独立审查继续保留。

沿用 #31 已确认 `e2029719…` 的 Project/侧栏/Workspace/持续底部 Player、中英文及亮暗要求，#39 `35bb7dc…` 的 Candidate 明确保存与快照冻结规则，以及 #43 `23645dac…` 的来源身份纠正。没有重新探索整体视觉或添加 DAW、自动对齐、图数据库、生产 schema/迁移/路由。主动作使用创作语言；公开教程仍如实描述目前已上线行为，#48 实际交付时再同步双语 A/B 玩法。

## 已实现的最小体验

预览的固定 forest 为 V1→V2/V3 与一个独立起点；只有明确保存的模拟 Version 进入图。多个根是真实 `parent=null`，Candidate/草稿/Job 在图外。缺父或环关系显示关系不可确认，不补边、不把坏节点当根，不递归出假历史。读取失败与空历史不同，明确重读可恢复。

检查任意旧 Version 的输入、Score/音频结果与父关系，点“从此版本继续创作”，再明确使用其输入；当前草稿不会因仅检查另一节点而被覆盖。提交冻结起点/ABC/style/lyrics/seed；任务期间的修改不进入旧 Job。完成只产生 Candidate，命名并明确保存才追加子节点。生成失败/取消保留旧历史；保存失败保留 Candidate/name/首次保存意图，同意图重试一次保存，重看已存结果不重复加节点。

A/B 只选择模拟 Project 中两个不同、有音频的已保存 Version；只有一份时仍可听 A。一个持续 audio/WaveSurfer+Regions 拥有真实时钟、waveform、seek、play/pause/ended。加载暂停旧源，目标真实就绪后才可播放；快速迟到加载只能发布最新选择。明确试听 Candidate 改源并显示独立候选标签，返回 A/B 从 0 暂停。纯标签/语言/主题变化保持同一媒体源。

| 边界 | 冻结行为 |
| --- | --- |
| A/B 切换 | 保留绝对秒数；原先播放且目标范围有效，则就绪后续播；原先暂停则仍暂停。不做比例/拍点/精确音乐对齐。 |
| 长 A33 秒→短 B31 秒 | clamp 到实际 B native end 并暂停；回长 A 仍暂停，不自动重播。 |
| 自然结束 | 留在 native end、paused；明确播放可从 0 重播，不自动切侧。 |
| seek | 鼠标/键盘，范围为当前实际 native duration；取消当前一次片段限界，保留可见有效 region。 |
| 共同 region | 一个秒数片段，在两份真实样本共同区间内；可设置、拖动、缩放；一次播放到 end 暂停，不循环。负值/空值/倒序/越界拒绝。 |
| 更换 pair | 暂停，从 0 开始；仍有效的片段可保留，超出新共同区间则明确要求重设。 |
| 刷新 | 只恢复 namespace/per-Project 中仍有效的 pair ids/active side，0 秒暂停；region/position/playing 不恢复。新模拟分支重置，失效 id 明确提示；storage 不可用仍可本次试听。 |
| 失败 | 实际坏字节真实解码失败，旧源停止；重载同侧或换有效版本恢复，不生成 Job、不删除旧历史。 |

## 媒体来源纠正与最终副本

此前只读准备误写“两份 P4 音乐来自不同 Project”。Root `p4-real-samples.json` 与 `46-media-lineage-correction.md` 纠正：两份属于同一 Project `a0ac0436…`，共享 Reference `5855dc17…`、Transcribe `8edad40d…`、original ABC 与 parent `cc4298f6…`。真实 saved melody `32689856…`、full `94909afa…` 是兄弟 Version；不同验收目录只是数据库快照。本票已经按该事实记录来源。

完整字段/hash/输入见 [sample-provenance.json](https://github.com/CaiZongyuan/llm-music/blob/aec081f8e5254a9dc1f7ba4b606ffd7211add679/docs/previews/version-compare-v1/sample-provenance.json)。A 为历史 melody MP3，34.9986667 秒，SHA256 `557a933bc217976dac521f0699ac78e9762b58148793dd350a8b810170befa5f`。full 原 MP3 为同等时长，SHA256 `beffee708a9ae829132cf7f6bc82ce86540e1daa36500d32c0eac246b931768f`。二者不同 style/seed，不能声称受控模式性能/质量比较。

B 是 full 历史音频实际解码并裁切 `[0,31]` 的 **PCM16 stereo48k WAV 试听副本**，5,952,044 B，SHA256 `98ee0e702d251d4c6b6cc9874b63b61e7880b42a9928e6caa5ae2ebeb850b837`。CPU 全解码为 31 秒，原始两个文件 hash 保持不变；不是把 metadata 改短，也不是原 saved full Version 的音频。模拟 graph/Score/输入/任务/保存与实际音乐 lineage 分开；模拟风格变化不生成新音乐。

生成媒体模块留在 owned scratch，SHA256 `a644e1fbda415de4f41566865f7e0d4f39b63b231c2bd7062f6f18e668a404fe`。可执行 `prepare-media.py` 已随预览保存：可只读本地样本，或从固定已发布 evidence 提交下载并核对 hash。生成物不提交 Git，独立 pnpm/uv 命令和停止方式见 README。当前实际媒体准备借用 Root 已安装的 CPU av16.1.0/numpy2.5.3 interpreter；无环境安装/修改，无 Torch/model/GPU。

## 作者实际验证与失败修正

2026-10-08，使用独立 `version46-developer` agent-browser Chromium session、软件渲染，从公开按钮/DOM/原生 audio 检查；一次性核验脚本、原始 facts/失败、截图、网络与 source receipts 保留在 Root owned `.scratch/p5-development/46-preview/`。没有新增镜像实现的产品单元测试、生产 API/GPU suite 或 Swagger 录屏。

- `complete-facts-wav.json`：**37 条公开浏览器事实通过**，涵盖单 audio/真实 waveform，暂停 12 秒换侧与播放续播，A/B 2–4 秒各在 4 秒暂停，region 非法输入与 seek 取消限界，标签/语言/主题持续、换 pair 片段失效/0暂停、重复 pair 拒绝、迟到 A→B→A、33→31 clamp、自然 ended/明确重播、读失败/加载/恢复、缺父/环不画关系、空/一份/无音频、生成失败冻结及新 Job 重试、保存失败意图、候选真实试听、显式保存/不重复、取消和 storage 失败。
- `extra-facts.json`：**6 条补充事实通过**，片段播放中换侧仍在 native 4 秒暂停；连续从 V1 保存两个方向，再从旧 V2 派生，图计数/父关系按明确起点增加；新模拟 saved id 选择后等待实际刷新；窄屏片段按钮可见且 hit-test 命中。
- `refresh-facts.json`：实际 browser reload 恢复固定 V2/V3 pair 与 active B，native 0 秒、paused、无 region、audio count=1。`lost-pair-refresh.json`：含新模拟 id 的 pair 实际刷新后显示失效，原固定四节点恢复，没有自动播放。
- 键盘真实 End/Home 分别读到 seek31/0。390×844 实际 mouse 操作改变 region：一次 resize 得 2.00→5.74，再 drag 得 3.74→7.48；document/player 均宽390。桌面1440×960与窄屏截图实际检查，窄屏选择/播放/片段可点击，无整页水平溢出。
- 有界简化后 `final-affected-facts.json` **7 条受影响检查再通过**：saved-only graph、Candidate/显式保存/旧快照、A33→B31、真实坏 Blob 失败与有效对恢复。完整37条与补充6条的未改变行为按语义差异复用，不把复用写成整套重跑。
- exact WaveSurfer7.12.1 独立 pnpm frozen install、`node --check` 两个 JS、`git diff --check` 通过；media CPU 全解码/原始 hash 校验通过。`static-facts.json` 读回 HTTP200 与实际源码相同 bytes、HEAD200、POST405、allowlist 外404、CSP `connect-src 'none'`。记录的 browser130 requests 全为 owned18096 GET/本地 Blob，业务写入0；`page-errors.json` 未捕获页面错误0。

原始失败没有抹掉：首轮坏 Blob 在 WaveSurfer 的 metadata 等待停住，真实 native error4，不能恢复。修复为先用 AudioContext 实际解码坏字节，再交给唯一 Player；异常被明确捕获，不依赖永远不会到的 metadata。目标可播放后才标就绪。

随后 MP3 裁切副本重复 seek 到尾部时，native duration 出现 31.03466/31.05768 秒估计修正，导致“已结束”与实际末端断言失败；改为上面的真实31秒 WAV，而非放宽错误结尾断言或改 metadata。原 MP3 试验和失败 facts 留在 scratch，最终验证使用 WAV。一次 harness 在刷新已恢复 B 时误把当前源当长 A，已改为明确选择 A 后测试；一条 PowerShell 复杂双引号 probe SyntaxError 和25秒 wait超时也保留，后续采用文档支持的 Base64 eval。未将工具故障记作页面通过。

## 有界复杂度检查

检查固定基线到本票全部10个源码/运行文档文件、新文件与立即消费者，不动其它应用/库。保留关系合法性、模拟创作快照/保存、pair选择和单媒体生命周期这些不同职责；复用一套消息表、一个 forest validator、WaveSurfer+Regions、一个 `<audio>`，不新建框架/store/图 API。删除没有消费者的 `loadedId` 状态，将预解码缓存从额外 AudioBuffer 改为“已验证”Set，避免同时留两套媒体缓冲；唯一 WaveSurfer 仍拥有实际 waveform。局部简化之后完成上述7条受影响重验，正式独立 review 由 Root 针对完整交接 head 执行。

## 服务所有权与交接

作者旧服务 PID42624 / parent51592 / birth1791482050.405 已按完整进程身份核对，用 owned stop-file graceful关闭；exec33433 exit0，读回18096无监听，作者浏览器已关闭。

冻结源码服务已重新启动在同一 owned18096：PID **51140**、parent **26392**、实际 birth **1791483394.268**，exec session **94251**，实际 Node script 为本工作树 `docs/previews/version-compare-v1/serve.mjs`。`freeze.json` / `server-owner.json` 保存身份与 served hashes；它们一起作为停止依据，不能只按端口认领进程。stop-file 为 Root `.scratch/p5-development/46-preview/media/stop-preview`；仅在再次核对身份后创建以 graceful关闭。

冻结服务供 Root 独立复查，作者不再改源码。Root 是 sole Native/GPU owner；protected8188 / PID50752 / birth1791306524.2399251 / parent38748 未写入、未停止、未 interrupt/free。根 package/lock、API/app/source、用户暂存与无关 skills/design/previews 未改。本票独立 review/真实集成读回之后，Root 按既有豁免自动派发 fresh #47；不追加用户确认等待。

## 非作者 Spec P2 修复：持续试听身份

Root 的两位非作者对 `3f4c78d…` 分别报告 Standards0、Spec1项P2。Spec 在 `46-review/spec.md` 指出：Candidate1正在试听时，Candidate2成功完成会替换当前 Candidate，原 Player label 查不到旧 id，虽实际 audio/src/clock继续，却失去候选或已保存身份。Root `candidate-identity-red.json` 从公开操作独立确认未保存/已保存两种反例；原37+6作者事实没有覆盖第二次成功完成，此缺口明确保留。

本次只改 Player 的本地来源选择：载入时捕获精简、冻结的 id/name/audio/Candidate或saved身份，不再在每次绘制时依赖“当前显示的 Candidate”。新 Job/结果不会删除正在听的身份；retry同一旧来源仍用原快照。明确保存当前正在听的 Candidate 时，仅更新该匹配来源的 saved id/name，不改媒体或时钟；保存另一个 Candidate 不能改名旧试听。状态行显示所听候选/已存记录 id，避免把相同默认名字归给新结果。场景重置和明确换侧继续按原规则清除或替换来源。

有界简化将保存后的来源身份更新放在单次 render之前，保留一个媒体owner、一次状态发布；不新增 store、播放器、API、依赖或后台运行。`node --check app.js`、`git diff --check`已通过。作者按Root窗口所有权要求**未执行浏览器、构建、GPU或服务操作**，不宣称修复行为已通过。Root将以重新冻结候选运行原始双反例和 targeted公开回归：旧src/time/playing/label/id/audio1保持，保存正在听的候选更新身份，保存后续候选不改旧身份，明确返回A从0暂停。脚本 `46-preview/candidate-identity-regression.js` 已提供，结果待Root实际写回；未改变的37+6作者及11条Root trusted浏览器证据按语义差异复用。

Root最初的 synthetic播放因 userActivation=false 得到真实 NotAllowedError，已经用trusted原生点击解决后获得 `root-browser-facts-trusted.json` 11条通过；这是测试前提修正，不是产品解码缺陷。旧作者服务51140在Root读回时已经不存在、18096无监听；当前独立浏览器与静态服务归Root，PID50664、parent60304、exec72898，stop-file为 `root-stop-preview`。上述旧服务身份保留为历史，**不作为当前停止依据**；本次作者没有停止它或 protected Native50752。
