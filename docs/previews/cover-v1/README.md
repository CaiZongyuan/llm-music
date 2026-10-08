# Cover 白盒流程交互预览

关联 [#43](https://github.com/CaiZongyuan/llm-music/issues/43)、[Generation #8](https://github.com/CaiZongyuan/llm-music/issues/8)、[Transcription #7](https://github.com/CaiZongyuan/llm-music/issues/7) 与 [Score #9](https://github.com/CaiZongyuan/llm-music/issues/9)。确认记录见 [docs/ui/43-cover-preview.md](../../ui/43-cover-preview.md)。这是尚未发布的 Cover 流程预览；当前正式 GenerateFromScore 仍固定 full。

## 启动

仓库根目录执行，使用独立锁定的 abcjs 6.7.1；无需 API、数据库或 GPU。

```powershell
pnpm --dir docs/previews/cover-v1 install --ignore-workspace --frozen-lockfile
pnpm --dir docs/previews/cover-v1 run start
```

打开 <http://127.0.0.1:18084/llm-music/cover-preview/>。如端口属于其他进程，不停止它；在 `run start` 后传入未占用端口。启动器拒绝 Runtime 8188 与旧预览 18030–18033、18072。只停止本次拥有的静态服务。

## 试一条创作路径

1. 使用历史 V1 参考，或选择本地 WAV。文件只在浏览器读取；本预览限制 25 MiB、40 秒以内，不作为正式上传全范围的声明。
2. 选择 full 并模拟转谱。检查示例 ABC 的两个声部、音符、节奏及和弦。转谱是独立模拟示例，不能据此判断参考音频转谱准确度，也不自动识别歌词。
3. 修改 ABC、试听当前 MIDI，再明确选定 Score。导出 MIDI 和本地简单音色试听来自真实 abcjs。
4. 切换 melody：原稿与原选定快照保持完整，有效输入预览去掉音乐和弦标记，保留 Vocal/Ins 音符、节奏与头部名称。再次明确选定，再“试听选定的有效输入 MIDI”。模式、参考或转谱 Score 改变时，必须重新明确选定，即使新 ABC 文本相同；旧快照仍可查看。
5. 修改新风格、歌词或 seed，模拟生成。Reference Audio 只进入模拟转谱；生成使用已选定的有效 ABC、mode、style、lyrics 与短片段设置。任务快照冻结，后续编辑不进入旧任务。
6. 结果先成为 Candidate。试听时明确使用历史 PR #58 音乐，再命名并模拟保存为 Version。历史 V1 参考的派生版本保留明确 V1 parent；本地参考没有父版本。旧版本保持完整。

下方有“完整改编”“失败后继续”“切换模式”三条可执行引导；切换引导会从已知空状态开始。上方仍可自由尝试操作，状态面板显示来源、选定、提交、Candidate 与已保存版本。切换歌词、版本、语言或主题时，唯一底部 Player 继续播放。

## 模式的实际依据

锁定插件 `fc78df9dfb214f396aa281f5b03519cefff5b00a` 的 [Transcribe](https://github.com/pytraveler/YuE2-ComfyUI/blob/fc78df9dfb214f396aa281f5b03519cefff5b00a/yue2_comfy/transcribe.py)、[ABC 重建](https://github.com/pytraveler/YuE2-ComfyUI/blob/fc78df9dfb214f396aa281f5b03519cefff5b00a/yue2_comfy/sheetsage/abc_rebuild.py) 与 [生成协议](https://github.com/pytraveler/YuE2-ComfyUI/blob/fc78df9dfb214f396aa281f5b03519cefff5b00a/yue2_comfy/vendor/yue2/protocol.py) 是模式来源。

| 模式 | 用户可检查的音乐提示 | 正式后续映射 |
| --- | --- | --- |
| melody | 两个声部的音符、节奏；不提交和弦标记，新风格引导伴奏 | Transcribe `mode=melody`，或明确选定 full 谱的去和弦派生输入；Generate `cot=melody`，传入该有效 ABC |
| full | 两个声部的音符、节奏和已有和弦，作为和声提示 | Transcribe `mode=full`；Generate `cot=full`，传入该有效 ABC |

生成器的模式指令不会自动增删传入 ABC 的和弦。预览只在音乐行删和弦，保留带引号的声部名称；与锁定 [strip_chords](https://github.com/pytraveler/YuE2-ComfyUI/blob/fc78df9dfb214f396aa281f5b03519cefff5b00a/yue2_comfy/vendor/yue2_music/abc_tools.py) 的此示例输出实际比对。无和弦谱切 full 不会凭空恢复听到的和弦，页面明确提示无显式和声；可恢复原 full 转谱谱或明确重新转谱。两模式均不代表复制录音音色、保留全部伴奏或保证音频逐音一致。

初始示例由独立研究者用锁定 CPU 解析器验证：四小节、96 BPM，16 Vocal 音符、8 Ins 音符、4 个和弦；melody 保留两声部音乐网格与音符、去掉 4 个和弦。不是 GPU 推理结果。此预览只检查简单双声部 ABC 方言和完整等长小节；正式 API 的完整支持边界仍由 #44/#45 验证，不将 abcjs 接受范围当成 Runtime 接受范围。

## 尝试失败与恢复

“检查其他状态”提供转谱失败、无效 ABC、谱面失败、模式未支持、缺模型、显存不足、生成失败、保存失败、暂停与取消竞态。每次故障仅影响对应操作。无效文本保留；上一份有效谱面明确标为过期，不能用于试听、导出或新选定。重新检查可恢复。

转谱失败/取消和生成失败/取消保留参考与有效中间乐谱。重试生成使用同一冻结输入并创建新 Job；不会自动产生 Version。不支持模式或缺模型时拒绝新任务，不替换模式。保存失败保留 Candidate 与名称，重试显式保存同一结果。Reference 变化时旧谱可见，但必须为新 Reference 转谱并选定后再提交。同一 Reference 再次转谱也产生新的 Score，旧选择不能仅因 ABC 相同而用于新来源。

## 隔离与证据

真实本地行为：WAV 文件读取与解码、abcjs SVG/MIDI、当前或选定有效 MIDI 生成的 PCM WAV 试听、媒体时钟、seek 和原生下载。预览限制派生 MIDI 为 120 秒、10,000 音符以内；试听是简单合成音色。

模拟行为：Project、Reference/Score 身份、Transcribe/Cover Jobs、mode capability、模型状态、阶段、Candidate 与 Version 均只在本页内存。刷新重置。阶段只显示未知进度，未推测百分比。没有业务 API、Runtime 或 GPU 请求，也没有真实上传/持久写入。页面 CSP 禁止连接，静态服务只允许列出的 GET/HEAD 文件。

历史 V1→Reference→派生 parent 目前只在隔离预览模拟，现有正式 API 不支持该来源转换。正式 #44 将从 Version 的真实 audio Asset 受控提取当前支持的 16 秒 WAVE 参考片段，记录 source Version、source Asset、区间及 hash，用该实际关系支撑 parent；不接收任意 parent，也不提供通用转码平台。本地上传 Reference 没有 parent。此预览试听仍播放已标识的完整历史样本，不声称已实际提取该片段。

参考/结果试听复用已标识 [历史 PR #58 音乐与 provenance](../web-mvp-v1/sample-provenance.json)，没有重复存入音乐二进制；它与独立 ABC 不声称对应，不证明此次模式、编辑或风格的音频效果。中文/英文、亮/暗主题与已确认 #31/#39 布局延续。源码、验证与已知边界记录在 UI 交接文件；预览确认前不实施正式 Cover。
