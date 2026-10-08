# Version 分支与 A/B 交互预览

关联 [#46](https://github.com/CaiZongyuan/llm-music/issues/46) 和 [#11](https://github.com/CaiZongyuan/llm-music/issues/11)。沿用已确认 #31/#39/#43 Workspace、持续唯一 Player、中英文与亮暗模式。新确认已按用户“后续不用我确认了，你快速开发玩吧”豁免；浏览器验证及纠正保留在 [交接记录](../../ui/46-version-compare-preview.md)。正式 branch/compare 仍由 #47/#48 交付。

## 运行 / Run

仓库根目录执行。媒体准备只使用 CPU，下载两个固定提交的已公开音乐并核对 SHA256；不加载模型，不连接 API 或 Runtime。`uv --no-project` 使用独立临时环境，不修改 FastAPI/ComfyUI 的环境或 lock。只有生成媒体和模拟比较选择落在本地预览目录/localStorage。

```powershell
pnpm --dir docs/previews/version-compare-v1 install --ignore-workspace --frozen-lockfile
$preview46MediaDir = Join-Path (Get-Location) '.scratch/46-preview-media'
uv run --no-project --with av==16.1.0 --with numpy==2.5.3 python docs/previews/version-compare-v1/prepare-media.py --output-dir $preview46MediaDir
pnpm --dir docs/previews/version-compare-v1 run start -- 18096 $preview46MediaDir
```

打开 <http://127.0.0.1:18096/llm-music/version-preview/>。上述变量保留绝对媒体目录，因为 pnpm `--dir` 会改变工作目录。也可在仓库根用 `node docs/previews/version-compare-v1/serve.mjs 18096 .scratch/46-preview-media`。

已有历史样本可在准备命令追加 `--source-a /absolute/melody-cover.mp3 --source-b /absolute/full-cover.mp3`，只读原文件并校验相同 hash，免下载。Root 本次实际借用已安装 av16.1.0/numpy2.5.3 的 CPU interpreter 执行同一脚本；没有创建或修改 API 环境。生成物不进入 Git。缺少 `media.js` 会明确拒绝启动，不降级成假音频。

Stop only your own preview process. The server prints/writes PID, parent, script, URL, stop-file and served hashes in the media directory. After verifying process identity, create the reported stop-file to close gracefully. An existing stop-file must be removed before restarting. A busy port is an error; choose another free loopback port instead of stopping its owner. Protected Runtime8188 and older preview ports are rejected.

## 试两条路径 / Try two paths

1. 检查 V1 的输入、Score 与父关系，点“从此版本继续创作”，再明确“使用此版本输入”。修改风格或歌词，模拟生成。完成只产生 Candidate，图不变化。
2. 给 Candidate 命名并明确保存，才追加 V1 的子节点。重复查看同一已保存结果不会增加版本；可以再次从 V1 或任意旧节点开始，保留不同方向。生成/保存失败与取消不会改写旧快照。
3. 选择 A/B 两份不同且有音频的已保存模拟 Version。“使用这对版本”从 0 秒暂停；明确播放后切 A/B 保留绝对秒数。所有操作都在一个 audio/WaveSurfer 中，不做精确音乐对齐。
4. 展开共同片段，设置 2–4 秒。播放一次在 4 秒暂停，不循环。波形中的片段可拖动/缩放，边界限制在两份音频共同区间。seek 会取消当前一次片段限界。
5. A 在 33 秒切到 B 的真实 31 秒 WAV 副本，会停在 B 末端并暂停；返回 A 仍暂停。自然结束保留末端，明确播放可从 0 重播。
6. 切 Score/lyrics/版本标签、语言或主题保持同一播放器；明确试听 Candidate 会改源并显示候选标签，返回 A/B 从 0 暂停。

Inspect V1, explicitly use its inputs, then simulate generation. The completed Candidate stays outside the graph until you name and save it. Select two saved versions with audio for A/B. Switching preserves absolute seconds, including paused/playing intent; a shorter target clamps to its native end and pauses. The common region plays once and stops at its end. Tabs, language and theme keep the sole player mounted.

## 状态与刷新 / States and reload

可执行场景覆盖无历史、单份版本、无音频、实际坏音频字节、缺父/异常环、读取失败和加载。读取失败与空历史分开；异常关系不画成根节点。只有一份时仍可试听 A，B 禁用。下一次故障可选择生成/保存失败；失败保留提交快照或首次保存意图，明确重试。迟到 B 的模拟延迟用于检查最新选择，不用计时器冒充媒体时钟。

真实刷新只恢复本预览 namespace 中仍有效的 pair Version ids/active side，重新检查固定示例，从 0 秒暂停；播放位置、片段和新模拟分支不保留。若 pair 引用本次新保存的模拟节点，刷新后会明确失效，要求重新选择。存储不可用会提示，但本次比较仍可使用。不是 SQLite/API 持久恢复证据。

The simulated creative work resets on reload. Only valid fixed-fixture pair ids and active side recover, paused at 0, with no region. A pair containing a newly simulated saved version becomes invalid after reload and asks for a new choice. Storage failure is explicit and does not prevent current listening.

## 媒体、隔离与边界 / Media and boundaries

[sample-provenance.json](sample-provenance.json) 是实际历史音乐来源。两份 P4 音乐来自同一真实 Project，具有相同 Reference/Transcribe/original ABC/parent，真实 saved Versions 是兄弟关系。不同验收目录是快照，不是不同创作 Project。风格与 seed 不同，不能把它们当受控模式质量/性能比较。

A 为原 34.998667 秒 MP3 试听副本；B 将 full MP3 真实解码并裁切 `[0,31]` 后保存成 PCM16 stereo48k WAV。使用 WAV 避免 MP3 seek 末端的时长估计变化；没有修改原素材。31 秒副本不是原 saved full Version 的音频。模拟 forest、ABC/Score、输入、任务、Candidate 和保存与这些真实业务记录分开，模拟新风格不会生成新的音乐。

WaveSurfer/Regions 固定为 7.12.1。音频字节通过 owned 静态 JS 模块转换为本地 Blob；真实解码/波形/native audio 驱动播放。坏 Blob 先真实解码失败，避免一直等待不存在的 metadata；真实媒体可播放后才标就绪。只有一个 audio，无第二播放时钟或假波形。CSP `connect-src 'none'`，静态服务只列出 GET/HEAD 文件、拒绝 POST/其它路径；页面不发送任何业务请求。

No new inference, quality claim, automatic beat alignment, looping, graph database, production schema, or full audio editor is introduced. This preserved preview answers branch/save/compare behavior; #47/#48 implement the real API-backed experience after review.
