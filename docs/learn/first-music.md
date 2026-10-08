用一份温暖的民谣流行配方开始 Morning song 项目。先得到可试听的 Candidate，再检查曲谱，决定是否保存。

## 你会得到什么 {#start}

<p>一份约 35 秒的 FLAC 音频，以及同次生成的 ABC 曲谱。这个教程使用真实生成已验证过的风格、原创歌词和 seed；首页 MP3 就是当时的压缩试听副本。重新运行的质量与耗时仍需实际检查。</p><p>开始时可以没有 Project。先按<a href="./resources.md">准备指南</a>启动已就绪的真实 Runtime 与应用 API；如果只想练习保存流程，可以用 fake 模式，但听到的是测试音调。</p>

## 1. 先描述你想听到的声音 {#style}

<p>这个配方先说明语言与类型，再给人声、两种主要乐器和节奏。清晰的重点比堆叠相互冲突的风格词更方便调整。</p>

**已验证风格 · style**

```text
English, gentle folk pop, warm clear voice, acoustic guitar and piano, light bass and drums, 96 BPM
```

<p>先保持原样。想换成电子或更安静的编曲，放到下一章单独尝试；BPM 与风格词是创作意图，不能保证输出逐项精确遵循。</p>

## 2. 给片段一个小主题 {#lyrics}

<p>这个例子写早晨与陪伴。使用简短句子，分成 Verse 与 Chorus。35 秒只能承载短片段，不要求唱完每一句；先听语言与句子是否自然。</p>

**原创歌词 · lyrics**

<<< ../../services/api/examples/creator/morning-song-lyrics.txt

<p>这份原创歌词与配方已经保存在受版本控制的示例中。先保留原句和段落标记，便于下一章只改一句。</p>

## 3. 生成一次，保留这次任务 {#generate}

<p>使用 seed <code>2026192201</code>，片段设置保持 <code>max_seconds=35</code>。把 Project 命名为 Morning song；后面的变体继续放在这个 Project 中。</p><p>打开正式 Web 的“音乐生成”，填入上面的风格、歌词与种子，选择“生成一段音乐”。按<a href="../guides/web-generation.md">工作区生成指南</a>检查任务、试听、看谱，再选择“保存为版本”。没有百分比时看阶段名称即可；暂时没变化不代表要重复提交。需要命令行操作时再展开下面的补充。</p>

<details class="creator-supplement"><summary>补充操作入口：使用现成 CLI</summary>

<p>在仓库根目录、已启动 API 的第二个终端执行。示例会创建所需下载目录并使用上面的受控歌词。命令会创建 Project、向已配置 Runtime 提交生成，并下载 <code>audio.flac</code> 与 <code>score.abc</code>；不会保存 Version。输出目录必须尚不存在。</p>

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py generate --style "English, gentle folk pop, warm clear voice, acoustic guitar and piano, light bass and drums, 96 BPM" --lyrics-file services/api/examples/creator/morning-song-lyrics.txt --seed 2026192201 --output-dir data/morning-candidate-01
```

命令直接调用现成 CLI，读取上面的受控歌词。需要查阅工具行为时，完整受控源码如下。

<<< ../../services/api/examples/generate_save.py

</details>

## 4. 先听，再看曲谱 {#listen}

<ol><li>播放下载的 <code>audio.flac</code>。先完整听一次，再听人声是否可懂、伴奏是否贴合情绪、结尾有没有突兀中断。</li><li>打开 <code>score.abc</code>，或用自己的 ABC 阅读工具查看。对照音频中的旋律和节奏，记下一处想继续尝试的地方。</li><li>记下“我想保留什么”和“下一次只改什么”。声音能播放与文件校验通过，不等于音乐一定满意。</li></ol><p>这时它仍是 Candidate。当前生成路径提供音频与 ABC；<a href="./reference.md">参考音频转谱</a>提供原 MIDI，也可在<a href="./edit-score.md">内置编辑器</a>中修改 ABC、试听并导出对应 MIDI。内置 A/B 比较尚未交付。</p>

## 5. 喜欢了，再明确保存 {#save}

<p>给这个结果一个能记住意图的名字，例如“Morning · warm folk”。保存会留下这次输入、结果与来源信息；以后试其他配方不会覆盖这份音频或曲谱。</p>

<p>还不满意就保留 Candidate 继续尝试，不必为了每一次生成都保存 Version。用同一 Candidate、名称和父版本重复保存会返回同一 Version。</p>

<details class="creator-supplement"><summary>当前保存入口：Candidate → Version</summary>

<p>将占位值替换为上一步终端输出中的实际 id。这个命令向相同 Project 写入 Version。</p>

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py save --project-id <PROJECT_ID> --candidate-id <CANDIDATE_ID> --name "Morning - warm folk"
```

</details>

## 如果等待超时，先找回同一次结果 {#recovery}

<p>CLI 等待超时会提示 Project 与 Job id。先在本地 Swagger 的“读取 Job”操作中查询这两个 id，查看已完成结果、排队状态或错误。不要直接再跑一次生成命令：原任务可能仍在执行。</p><p>若任务明确 failed，阅读 error 与 recovery_required。先解决原因；无法确认是否已执行时，请让 Runtime 管理者核对。确认可以重试后再显式提交新任务，原 Job 与素材继续保留。</p>

## 下一步：同一首歌词，换一种味道 {#next}

<p>保留这个 Project、原歌词、seed 和喜欢的 Version。<a href="./variations.md">下一章只改一个输入</a>，让变化更容易听清。想亲手改旋律时，进入<a href="./edit-score.md">乐谱编辑与重新生成</a>：先改一句、试听并选定，再保留带来源父版本的新作品。</p>
