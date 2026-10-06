# Local AI Music Workbench：已确认规格与 GitHub 票据

依据 [production](../production.md)、[领域术语](../../GLOSSARY.md)、仓库协作与[文档规范](../agents/documentation.md)整理。当前状态：**13 份规格与 36 张纵向票据已确认并发布 GitHub Issues，36 条原生父子关系及 46 条原生阻塞边读回核对通过；未调度产品实施**。

## 授权与当前事实

- 用户已确认 GitHub Issues（CaiZongyuan/llm-music）与默认分流标签。用户随后明确确认测试边界、粒度与依赖，并授权发布全部规格和票据。
- 当前只有规划、术语与代理技能，没有产品实现、测试先例、已确认 UI 或 GPU 验收结果。基线为 34c5a6678baca79e390d7505112b0157b174841d；用户原有 staged 修改保持原样。
- 规划建议的 SPEC-001 至 SPEC-012 保留；SPEC-013 补齐用户提供的在线文档约定。P0–P5 为本次实施规划；P6/P7 保留路线，尚不创建没有明确验收的实施票。
- 规划不代表应用已交付。已先发布规格父 issue，再按依赖顺序发布票据，写入原生 sub-issue/dependency 关系与 ready-for-agent；有阻塞票不能领取。

## 已确认的测试边界

| 阶段 | 最高公共入口 | 真实验证与限制 |
| --- | --- | --- |
| P0 | Doctor 命令与 Runtime 公开 API | RTX 3070 Ti Laptop 8GB 上实际转谱/生成/队列/取消/连续十项/清理；fake 不能通过 gate |
| P1 | FastAPI HTTP / WebSocket | Fake Runtime + 临时真实 SQLite/storage 覆盖状态、归属、导入、保存、重启；两条核心路径另做真实 GPU smoke |
| P2–P5 | 真实浏览器 → FastAPI | 日常 fake 交互验证；阶段验收真实 Web/FastAPI/ComfyUI/GPU，核验实际音乐产物 |
| 文档 | docs 命令、完整受控示例和真实浏览器 | 无 GPU 生成/构建，检查双语/引用/链接/base；发布后核验线上版本 |

新增 seam 限于当前需要的 InferenceRuntime 与应用公共接口，复用每条已建立闭环。纯逻辑单测只用于实际难以通过公共行为定位的边界，不以调用次数或内部节点结构断言正确性。

## 决策与风险

- Candidate 是未保存结果；创作者明确保存才成为 Version。生成和编辑不会自动污染历史，旧 Version 的输入/素材不会被覆盖。
- unknown 是 Runtime 对账结论，不添加第六种 Job 状态；恢复标识与有界确认窗口防止永久 running，不自动 resubmit。
- 真实稳定显存设置、完整 runtime/model revisions、合法样本和 Cover 模式语义在实施中验证，规划不虚构。
- 没有本机 GPU 证据是 P0 验收风险；缺模型/下载、全局 interrupt、持久导入与重启是早期高风险检查。
- P0 gate 后才能产品实施；P1 gate 后才能正式 Web。P3/P4/P5 按 production 阶段顺序交付，阶段门也记录为依赖。33→32 是 P5 排期门，不声称 A/B 技术上依赖 Cover。
- 文档与产品主链分开：15→16→17 不阻塞 P2 开发，但在线文档是当前 MVP 最终交付的一部分，因此 36 依赖 17。
- 新仓库没有需要 prefactor 的实现，不创建无用户结果的“数据库层/adapter 层/UI 层”横向票；这些模块随可验证闭环交付。

## 规格与来源覆盖

| 规格 | 阶段 | production 章节 / 额外来源 | 关联票据 |
| --- | --- | --- | --- |
| [SPEC-001: Runtime Validation](https://github.com/CaiZongyuan/llm-music/issues/1) | P0 | 6、25、35–39、54–55、59–63、66 | 01、02、03、04、05、06、15 |
| [SPEC-002: FastAPI Application Core](https://github.com/CaiZongyuan/llm-music/issues/2) | P1 | 4、9、12、25–27、40–41、55–56、62 | 07、08、09、10、11、13、14、16、24 |
| [SPEC-003: Data & Asset Model](https://github.com/CaiZongyuan/llm-music/issues/3) | P1，P3/P5 按消费扩展 | 12–16、26、30、54、68 | 07、08、09、12、14、19、27、34 |
| [SPEC-004: ComfyUI Runtime Adapter](https://github.com/CaiZongyuan/llm-music/issues/4) | P0 验证边界，P1 产品接入 | 5–8、16–20、28、37、49、58–60 | 04、05、08、09、10、11、12、14、28 |
| [SPEC-005: Workflow Registry](https://github.com/CaiZongyuan/llm-music/issues/5) | P0 固定 workflows，P1 registry，P3/P4 扩展 | 21–24、28–29、54、63 | 01、02、03、08、09、13、14、23、28、31、32 |
| [SPEC-006: Web Application Architecture](https://github.com/CaiZongyuan/llm-music/issues/6) | P2 | 2–4、10–12、27、32–34、42–43、50、55–56、59–62 | 18、19、20、21、22、23、24、25、26、33、35、36 |
| [SPEC-007: Transcription Experience](https://github.com/CaiZongyuan/llm-music/issues/7) | P0 验证，P1 API，P2 Web | 28–30、38–43、68 | 02、08、18、21、25、30、31、36 |
| [SPEC-008: Generation Experience](https://github.com/CaiZongyuan/llm-music/issues/8) | P0 验证，P1 API，P2 Web；P4 Cover | 23、28–29、36–43、45、68 | 03、09、18、22、25、26、28、29、30、31、32、36 |
| [SPEC-009: Score Workspace](https://github.com/CaiZongyuan/llm-music/issues/9) | P2 查看，P3 编辑与重新生成 | 28–31、44、68 | 21、26、27、28、29、30、31、36 |
| [SPEC-010: Job & Progress System](https://github.com/CaiZongyuan/llm-music/issues/10) | P0 Runtime 行为，P1 应用生命周期，P2 Monitor | 16–20、38–43、57–60 | 04、05、08、10、11、12、14、18、20、25 |
| [SPEC-011: Versioning & Compare](https://github.com/CaiZongyuan/llm-music/issues/11) | P1 保存/父关系，P5 分支与比较 | 13、32、46、68 | 09、22、29、33、34、35、36 |
| [SPEC-012: Runtime Diagnostics](https://github.com/CaiZongyuan/llm-music/issues/12) | P0 命令，P1 API，P2 Web | 24、34–37、57–58、63 | 01、03、06、13、14、18、23、24、25、32 |
| [SPEC-013: Documentation & Developer Entry Points](https://github.com/CaiZongyuan/llm-music/issues/13) | P0 维护记录，P1 起按实装发布 | 54–57、59–61；仓库在线文档规则与文档维护规范 | 15、16、17、36 |

补充覆盖：production 1/11/33/67/68 的产品定位与 Workspace/完整闭环由 006–011 覆盖；2/50–52 的平台/Non-goals 见范围；53 为建议布局，由实际路径票据落实；64/65 的规格/Issue 层级由本次产物落实。production 47–49 与 51 属延后路线。

## 已发布票据：按依赖顺序

1. **[P0 · 锁定 Runtime 并以一条 Doctor 命令检查就绪](https://github.com/CaiZongyuan/llm-music/issues/14)**

   **Blocked by:** 无，可立即开始。

   **What it delivers:** 开发者从干净环境或已有合法本地模型出发，锁定 ComfyUI/YuE2-ComfyUI 与权重，运行一条命令即可知道目标 GPU 是否具备推理前提。

2. **[P0 · 通过 Runtime API 将固定音频转为 ABC/MIDI](https://github.com/CaiZongyuan/llm-music/issues/15)**

   **Blocked by:** 01「锁定 Runtime 并以一条 Doctor 命令检查就绪」。

   **What it delivers:** 开发者无需打开 Canvas，通过公开 API 将固定短音乐样本转成可解析 ABC 与有效 MIDI，能够复查请求、模型与输出。

3. **[P0 · 通过 Runtime API 生成固定 30–40 秒音频](https://github.com/CaiZongyuan/llm-music/issues/16)**

   **Blocked by:** 01「锁定 Runtime 并以一条 Doctor 命令检查就绪」。

   **What it delivers:** 开发者用固定 style、lyrics、seed 通过 YuE2 API 生成约 30–40 秒的可播放音频与 Score，建立本机资源基线。

4. **[P0 · 验证串行队列、History 和排队取消](https://github.com/CaiZongyuan/llm-music/issues/17)**

   **Blocked by:** 02「通过 Runtime API 将固定音频转为 ABC/MIDI」；03「通过 Runtime API 生成固定 30–40 秒音频」。

   **What it delivers:** 开发者连续提交已验证的转谱/生成请求，确认单 GPU 严格串行；移除一个排队任务后其余工作继续，history 能找回结果。

5. **[P0 · 安全取消运行任务并验证后续推理](https://github.com/CaiZongyuan/llm-music/issues/18)**

   **Blocked by:** 04「验证串行队列、History 和排队取消」。

   **What it delivers:** 开发者中止自己正在执行的请求，证明全局 interrupt 不影响错误目标，取消后下一项仍可完成。

6. **[P0 gate · 连续十项推理、清理与 P0 验收报告](https://github.com/CaiZongyuan/llm-music/issues/19)**

   **Blocked by:** 05「安全取消运行任务并验证后续推理」。

   **What it delivers:** 维护者获得本机连续运行、清理与性能证据，能据此决定是否解锁正式产品开发。

7. **[P1 · 通过应用 API 创建 Project 并持久上传音频](https://github.com/CaiZongyuan/llm-music/issues/20)**

   **Blocked by:** 06「连续十项推理、清理与 P0 验收报告」。

   **What it delivers:** 创作者只通过 FastAPI/Swagger 创建项目、上传参考音频并重新读取；文件由应用拥有且重启后仍可用。

8. **[P1 · 通过 FastAPI 完成 Transcribe Job 与 ABC/MIDI 获取](https://github.com/CaiZongyuan/llm-music/issues/21)**

   **Blocked by:** 07「通过应用 API 创建 Project 并持久上传音频」。

   **What it delivers:** 创作者在 Project 上传音频后创建 Transcribe Job，等待并获取应用持有的 Score/ABC/MIDI，无需理解 Runtime 的 prompt/node。

9. **[P1 · 通过 FastAPI 生成 Candidate 并显式保存 Version](https://github.com/CaiZongyuan/llm-music/issues/22)**

   **Blocked by:** 07「通过应用 API 创建 Project 并持久上传音频」。

   **What it delivers:** 创作者提交 style/lyrics 获得可试听 Audio 与可检查 Score Candidate，经明确保存生成 Version，并可再次读取。

10. **[P1 · 应用 Job 安全取消、领域错误与显式重试](https://github.com/CaiZongyuan/llm-music/issues/23)**

   **Blocked by:** 08「通过 FastAPI 完成 Transcribe Job 与 ABC/MIDI 获取」；09「通过 FastAPI 生成 Candidate 并显式保存 Version」。

   **What it delivers:** 创作者通过应用 API 取消 queued/running 转谱或生成任务，查看可读失败原因，并明确创建新的重试任务。

11. **[P1 · 提供领域实时事件与可恢复 HTTP Job 状态](https://github.com/CaiZongyuan/llm-music/issues/24)**

   **Blocked by:** 08「通过 FastAPI 完成 Transcribe Job 与 ABC/MIDI 获取」；09「通过 FastAPI 生成 Candidate 并显式保存 Version」。

   **What it delivers:** 应用客户端订阅 FastAPI WebSocket 得知真实阶段与进度；断线后通过 HTTP 找回同一任务状态。

12. **[P1 · API 重启对账并有界处理未知 Runtime 状态](https://github.com/CaiZongyuan/llm-music/issues/25)**

   **Blocked by:** 10「应用 Job 安全取消、领域错误与显式重试」；11「提供领域实时事件与可恢复 HTTP Job 状态」。

   **What it delivers:** 维护者重启 API 后，既有任务与结果根据 queue/history 恢复；无法确认的状态有明确、有界的处理，不永久停留 running 或再次推理。

13. **[P1 · 通过应用 API 查询 Runtime、模型与诊断](https://github.com/CaiZongyuan/llm-music/issues/26)**

   **Blocked by:** 07「通过应用 API 创建 Project 并持久上传音频」。

   **What it delivers:** 客户端仅访问 FastAPI 即可知道 backend/runtime readiness、模型状态与可用能力，并获取真实来源的诊断或明确缺失原因。

14. **[P1 gate · 验收 FastAPI 两条闭环与无 GPU CI](https://github.com/CaiZongyuan/llm-music/issues/27)**

   **Blocked by:** 12「API 重启对账并有界处理未知 Runtime 状态」；13「通过应用 API 查询 Runtime、模型与诊断」。

   **What it delivers:** 维护者通过公开 FastAPI 入口证明项目转谱与生成保存完整可用，取得无 GPU CI 和真实 Runtime smoke 证据，从而解锁 Web。

15. **[文档，P0 后 · 交付双语 Runtime 快速开始与文档站基础](https://github.com/CaiZongyuan/llm-music/issues/28)**

   **Blocked by:** 06「连续十项推理、清理与 P0 验收报告」。

   **What it delivers:** 新开发者按中英文快速开始，在文档站找到已验证的环境准备、Doctor 与第一条 Runtime API 结果，不把产品规划当已实现教程。

16. **[文档，P1 后 · 交付连续 API 教程与生成接口/配置参考](https://github.com/CaiZongyuan/llm-music/issues/29)**

   **Blocked by:** 14「验收 FastAPI 两条闭环与无 GPU CI」；15「交付双语 Runtime 快速开始与文档站基础」。

   **What it delivers:** 读者用同一个 Project 连续完成创建、上传、转谱、生成与显式保存，并能查到与真实接口一致的双语 API/配置参考。

17. **[文档发布 · 将已验证文档构建发布到 GitHub Pages](https://github.com/CaiZongyuan/llm-music/issues/30)**

   **Blocked by:** 16「交付连续 API 教程与生成接口/配置参考」。

   **What it delivers:** 读者能够打开实际 GitHub Pages 地址，查到与通过主分支 CI 的源码版本对应的完整可导航文档。

18. **[P2 · 确认 Web MVP 的可运行交互预览](https://github.com/CaiZongyuan/llm-music/issues/31)**

   **Blocked by:** 14「验收 FastAPI 两条闭环与无 GPU CI」。

   **What it delivers:** 创作者在隔离预览中实际操作 Library、Workspace、上传/转谱、生成/保存、Jobs 与 Runtime，确认正式 Web 的体验。

19. **[P2 · 在 Web 创建/打开 Project 并上传音频](https://github.com/CaiZongyuan/llm-music/issues/32)**

   **Blocked by:** 18「确认 Web MVP 的可运行交互预览」。

   **What it delivers:** 创作者在正式 Web Library 创建/打开项目，于 Workspace 上传并读取真实应用素材，刷新后仍能找回项目。

20. **[P2 · 在 Web 跟踪、取消与恢复应用 Job](https://github.com/CaiZongyuan/llm-music/issues/33)**

   **Blocked by:** 19「在 Web 创建/打开 Project 并上传音频」。

   **What it delivers:** 创作者在 Project Jobs 查看实际队列、运行阶段与结果，安全取消任务并在断线/刷新后恢复正确状态。

21. **[P2 · 在 Web 转谱、查看 Score 并下载 MIDI](https://github.com/CaiZongyuan/llm-music/issues/34)**

   **Blocked by:** 20「在 Web 跟踪、取消与恢复应用 Job」。

   **What it delivers:** 创作者上传 Reference Audio 后，在 Workspace 启动转谱、检查谱面/ABC 并下载有效 MIDI。

22. **[P2 · 在 Web 生成、试听 Candidate 并保存 Version](https://github.com/CaiZongyuan/llm-music/issues/35)**

   **Blocked by:** 20「在 Web 跟踪、取消与恢复应用 Job」。

   **What it delivers:** 创作者输入 style/lyrics，得到 Audio/Score Candidate，在持续播放器中试听，再明确保存 Version。

23. **[P2 · 在 Web 查看 Runtime、模型与设置就绪状态](https://github.com/CaiZongyuan/llm-music/issues/36)**

   **Blocked by:** 19「在 Web 创建/打开 Project 并上传音频」。

   **What it delivers:** 创作者从 Runtime/Settings 知道 backend、GPU、模型和当前任务是否就绪，能理解缺模型或失联原因。

24. **[P2 · 一条命令编排 API、Runtime 与 Web](https://github.com/CaiZongyuan/llm-music/issues/37)**

   **Blocked by:** 19「在 Web 创建/打开 Project 并上传音频」。

   **What it delivers:** 开发者从可复现入口启动三个独立进程，等待健康检查后打开可用 Web，停止时仅关闭本次启动的服务。

25. **[P2 gate · 验收 Web 两条路径与刷新持久恢复](https://github.com/CaiZongyuan/llm-music/issues/38)**

   **Blocked by:** 21「在 Web 转谱、查看 Score 并下载 MIDI」；22「在 Web 生成、试听 Candidate 并保存 Version」；23「在 Web 查看 Runtime、模型与设置就绪状态」；24「一条命令编排 API、Runtime 与 Web」。

   **What it delivers:** 维护者在真实浏览器确认 Web 已完成转谱和生成保存，刷新后项目/素材/版本/任务全部恢复，解锁 Score Editing Loop。

26. **[P3 · 确认 Score 编辑与重新生成交互预览](https://github.com/CaiZongyuan/llm-music/issues/39)**

   **Blocked by:** 25「验收 Web 两条路径与刷新持久恢复」。

   **What it delivers:** 创作者在隔离预览中编辑 ABC、看谱试听、导出 MIDI 并体验重新生成与显式保存，确认创作闭环。

27. **[P3 · 编辑 ABC、预览/试听并导出当前 MIDI](https://github.com/CaiZongyuan/llm-music/issues/40)**

   **Blocked by:** 26「确认 Score 编辑与重新生成交互预览」。

   **What it delivers:** 创作者在真实 Workspace 编辑 ABC，检查即时谱面、试听并导出对应 MIDI，无效输入能修正且不损坏旧保存结果。

28. **[P3 · 通过 API 将选定 Score 生成新 Candidate](https://github.com/CaiZongyuan/llm-music/issues/41)**

   **Blocked by:** 25「验收 Web 两条路径与刷新持久恢复」。

   **What it delivers:** 创作者或客户端通过 GenerateFromScore API 提交明确有效 ABC/style/lyrics，取得新 Audio Candidate 与来源快照。

29. **[P3 gate · 编辑 Score 后重新生成并保存派生 Version](https://github.com/CaiZongyuan/llm-music/issues/42)**

   **Blocked by:** 27「编辑 ABC、预览/试听并导出当前 MIDI」；28「通过 API 将选定 Score 生成新 Candidate」。

   **What it delivers:** 创作者在浏览器选择编辑后 Score 发起生成，试听新 Candidate，再保存有明确父关系的新 Version，完成 P3 闭环。

30. **[P4 · 确认白盒 Cover 与 melody/full 模式预览](https://github.com/CaiZongyuan/llm-music/issues/43)**

   **Blocked by:** 29「编辑 Score 后重新生成并保存派生 Version」。

   **What it delivers:** 创作者在隔离预览中从参考音频开始，检查/编辑转谱 Score，再选择新 style 与 Cover 模式，理解过程和失败恢复。

31. **[P4 · 完成 melody Cover 的可检查创作路径](https://github.com/CaiZongyuan/llm-music/issues/44)**

   **Blocked by:** 30「确认白盒 Cover 与 melody/full 模式预览」。

   **What it delivers:** 创作者选 melody 模式，完成参考音频转谱、Score 检查/编辑与新风格生成，试听后保存来源清晰的改编 Version。

32. **[P4 gate · 完成 full Cover 并验收两种模式](https://github.com/CaiZongyuan/llm-music/issues/45)**

   **Blocked by:** 31「完成 melody Cover 的可检查创作路径」。

   **What it delivers:** 创作者在同一白盒 Cover 路径选择 full 模式，能看懂区别、保留中间成果并保存新 Version；维护者取得 P4 两模式证据。

33. **[P5 · 确认 Version 分支与 A/B 比较预览](https://github.com/CaiZongyuan/llm-music/issues/46)**

   **Blocked by:** 32「完成 full Cover 并验收两种模式」。

   **What it delivers:** 创作者在隔离预览从旧版本建分支，选择两个 Version 并实际试听切换，确认比较体验。

34. **[P5 · 从旧 Version 创建分支并查看版本关系](https://github.com/CaiZongyuan/llm-music/issues/47)**

   **Blocked by:** 33「确认 Version 分支与 A/B 比较预览」。

   **What it delivers:** 创作者选一个已保存 Version 为起点创建新工作，保存后可浏览同 Project 的父子分支与输入/素材来源。

35. **[P5 · 在持续播放器中 A/B 比较两个 Version](https://github.com/CaiZongyuan/llm-music/issues/48)**

   **Blocked by:** 34「从旧 Version 创建分支并查看版本关系」。

   **What it delivers:** 创作者无需开多个文件即可选择两份已保存 Version，在同一播放区域快速切换、seek 和查看片段，继续检查 Score/lyrics。

36. **[P5 / 当前 MVP 总验收 · 验收两条完整创作闭环与已集成交付](https://github.com/CaiZongyuan/llm-music/issues/49)**

   **Blocked by:** 35「在持续播放器中 A/B 比较两个 Version」；17「将已验证文档构建发布到 GitHub Pages」。

   **What it delivers:** 维护者和创作者在已集成版本完成参考音频与风格歌词两条创作闭环，取得真实应用地址、在线文档和可追溯交付证据。

## 阶段与可领取前沿

| 阶段 | 票据 | 解锁 / 完成条件 |
| --- | --- | --- |
| P0 | 01–06 | 01 可开始；06 的真实目标 GPU gate 完成才解锁 P1 |
| P1 | 07–14 | 07 后 08/09/13 可准备并行；14 的两条应用路径通过才解锁 Web |
| 文档 | 15–17 | 15 需真实 P0；16 需真实已实现 P1；与后续 Web 开发独立 |
| P2 | 18–25 | 18 预览确认后实施；21/22 独立交付；25 验收刷新与两条路径 |
| P3 | 26–29 | 27 需预览；28 API 可独立于 UI 推进；29 交付编辑后生成闭环 |
| P4 | 30–32 | 30 先确认模式；31 完成公共 Cover 路径后 32 扩展 full |
| P5 | 33–36 | 33 先确认比较；36 还需要在线文档和实际集成结果 |

依赖表示真实功能或明确阶段 gate，不因同属一个规格增加多余边。源实现、重执行、独立 review 分开安排；四个可用 agent slots 不等同于四个 GPU workers，本次仅由 PM 作者整理，没有实施者或独立审查者。

## 确认与发布记录

用户于 2026-10-06 确认 GitHub Issues 与默认标签，并明确回复“认可测试边界、粒度与依赖，发布到 GitHub”。随后发布全部 49 个 issue，应用 ready-for-agent，建立原生关系。

读回检查核对每个 issue 的完整正文/标题、open 状态、标签、父子集合和精确 blocker 集合，全部通过。现阶段可领取的实施前沿仅为 [#14：锁定 Runtime 并以一条 Doctor 命令检查就绪](https://github.com/CaiZongyuan/llm-music/issues/14)；规格父 issue 不作为实施票据领取。

发布是本次规划任务的完成条件，不表示产品已实施或 P0 已通过。后续实施按阶段门、预览确认、独立 owner 和真实验证推进。

本地证据：[GitHub 映射](../../.scratch/local-ai-music-workbench/tracker-state.json)、[发布读回检查](../../.scratch/local-ai-music-workbench/publication-verification.json)、[规划结构检查](../../.scratch/local-ai-music-workbench/validation.json)、[PM checkpoint](../../.scratch/local-ai-music-workbench/current.md)、[离线时间线](../../.scratch/local-ai-music-workbench/timeline.html)。
