准备 16 秒参考音频，得到 ABC 与 MIDI。把曲谱和原音频放在一起检查，学会分辨值得继续研究的乐句与需要修正的地方。

## 1. 选一段容易听清的素材 {#choose}

<p>选你自己的短器乐片段，或已获许可的素材。为了方便检查，可以先挑主旋律清楚、背景不拥挤的一段；这是输入选择建议，不是转谱准确率保证。</p><p>当前真实路径只验证并接受<strong>恰好 16 秒、PCM16 WAV</strong>：24 kHz 单声道，或 48 kHz 双声道。用你现有的音频工具导出其中一种格式，保留原文件。可以在原音频中记下一个明显的音高变化或节奏，稍后用来检查。</p><p>上传允许的 64 MiB / 600 秒是存储预算，不能推断这些长度都能转谱。这个操作不会识别歌词，也不会自动生成 Cover。</p>

## 2. 上传到项目，再转谱一次 {#transcribe}

<p>继续使用 Morning song Project，把文件作为 Reference Audio 上传。打开正式 Web 的“参考转谱”，选择这份原文件，检查准备状态，再选择“开始转谱”。完成后查看乐谱并下载 ABC/MIDI；原参考音频保持不变。完整步骤见<a href="../guides/web-transcribe.md">工作区转谱指南</a>。需要 API 操作时再展开下面的补充；文档页面不会上传文件。</p>

<details class="creator-supplement"><summary>当前操作入口：本地 Swagger 的完整路径</summary>

<ol><li>打开已运行应用 API 的 <code>http://127.0.0.1:8000/docs</code>。生成环境应使用已就绪的真实 Runtime；fake 模式只返回标识的测试结果。</li><li>已有 Project 用原 id；若从本章开始，用 <code>POST /projects</code> 输入 <code>{"name":"Morning song"}</code>，记录返回的 id。</li><li>在 <code>POST /projects/{project_id}/assets</code> 填入 Project id，用 <code>file</code> 选择上面的 WAV。提交后记录响应中的 Asset id。</li><li>在 <code>POST /projects/{project_id}/transcriptions</code> 使用下面的 JSON，替换占位值。提交一次并记录响应中的 Job id。</li><li>用 <code>GET /projects/{project_id}/jobs/{job_id}</code> 读取同一个 Job，直到 completed 或明确失败。completed 的 result 给出 <code>score_id</code>、<code>abc_asset_id</code> 和 <code>midi_asset_id</code>。</li><li>用 <code>GET /projects/{project_id}/scores/{score_id}</code> 读取曲谱信息，再用 <code>GET /projects/{project_id}/assets/{asset_id}/content</code> 分别下载 ABC 和 MIDI。保存到自己的 Morning song 文件夹。</li></ol>

```json
{
  "reference_asset_id": "<REFERENCE_ASSET_ID>"
}
```

</details>

## 3. 对照听，而不只看文件是否存在 {#inspect}

<ol><li>先播放原参考音频，重新听你记下的那个乐句。</li><li>打开 ABC 文本，或用自己的 ABC 阅读工具看小节、节拍与音高。MIDI 可在你现有的 MIDI 播放器或音乐软件中打开。</li><li>对照原音频检查旋律走向和节奏。有偏差就记录发生在哪个乐句，不把能下载的曲谱当作完全准确的抄谱。</li></ol><p>应用会检查完整文件并导入 Score，但这些检查不能证明任意音乐的转谱准确性。可以在<a href="./edit-score.md">内置编辑器</a>中修正音符、试听并独立保存，再在正式 Web 重新生成；也可尝试<a href="./cover.md">melody Cover</a>，保留可检查的参考来源。</p>

## 如果格式被拒绝，修正导出设置 {#recovery}

<p><code>422 reference_profile_unsupported</code> 表示音频形状不在当前范围。检查是否为恰好 16 秒、16 bit 整数 PCM WAV，以及支持的声道与采样率。只改文件扩展名不能修正编码；重新导出支持的文件，再上传为新的 Reference Audio。</p><p>若提交回执不确定或等待断开，先查询已知 Job。不要通过反复上传或提交来找回结果。completed 时直接下载同一结果；明确 failed 时保留错误并按 recovery 指引处理。</p>

## 下一种玩法：把参考变成观察题 {#next}

<p>记下原片段的一个特征：节奏更稀疏、旋律更连贯，或某个乐句的起伏。检查、保存并选定这份 Score，再用<a href="./cover.md">melody Cover</a>只换新风格，判断伴奏如何变化。</p><p><a href="./variations.md">继续尝试风格与歌词变化 →</a></p>
