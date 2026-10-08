延续 Morning song：保留原配方，只改变一个维度。听出差别，再把最想留下的 Candidate 保存成有名字的 Version。

## 从上一段音乐继续 {#start}

<p>准备第一章的 Project id、原歌词、风格、seed <code>2026192201</code>，以及下载的音频。先回听一次，并写下一个问题：我想让编曲更空一点、改一句更好唱的歌词，还是看看另一个随机起点？</p><p>下面的变化只生成新的短片段，不编辑上一份音频。当前没有内置 A/B 播放器；用自己的播放器逐个试听。相同 seed 也不保证在不同模型、环境或版本下逐字节相同。</p>

## 1. 挑一个值得听的问题 {#recipes}

<p>点选配方，查看具体改了什么。第一份是已验证示例；其余是<strong>尚未调试或试听的灵感配方</strong>，用来说明尝试方向，不承诺效果。这里只替换教程中的输入示例，不会生成音乐。</p>

<music-input-recipes data-verified="已验证基线" data-inspiration="灵感建议 · 未试听" data-style-label="风格" data-copied="输入已复制" data-copy-failed="自动复制被浏览器阻止，请选择输入后手动复制。">

<div class="recipe-tabs" role="group" aria-label="选择输入配方"><button type="button" data-recipe="baseline" data-value="" data-note="保持第一章全部输入。先听温暖人声与木吉他、钢琴的组合，再写下下一次想改的一点。" aria-pressed="true">回听原配方</button><button type="button" data-recipe="style" data-value="English, gentle folk pop, warm clear voice, soft piano, restrained drums, 96 BPM" data-note="只把 style 改成钢琴主导、克制鼓组。歌词与 seed 保持原样，观察编曲是否更贴近你想要的留白。" aria-pressed="false">更轻的钢琴编曲</button><button type="button" data-recipe="lyrics" data-value="Morning sunlight finds the window" data-note="只改第一句。保留段落、其他歌词、风格与 seed，听措辞与咬字是否更合适。" aria-pressed="false">换一句表达</button><button type="button" data-recipe="seed" data-value="2026192202" data-note="只把 seed 改成 2026192202。风格和完整歌词不变，听另一个结果有没有更喜欢的旋律或组织方式。" aria-pressed="false">换一个随机起点</button></div>

<p data-recipe-status aria-live="polite">已验证基线</p><p data-recipe-description>保持第一章全部输入。先听温暖人声与木吉他、钢琴的组合，再写下下一次想改的一点。</p><p data-recipe-facts></p>

<details class="creator-supplement"><summary>查看与复制输入 · JSON</summary>

<<< ../../services/api/examples/creator/morning-song.json

<button type="button" data-copy-recipe>复制输入</button><p data-copy-status role="status"></p>

</details>

</music-input-recipes>

<script type="module" src="../../apps/docs/public/creator-recipes.js"></script>

## 2. 带着目标试听 {#intent}

| 玩法 | 先保留 | 重点听 |
| --- | --- | --- |
| 只换风格 | 原歌词、seed、35 秒设置 | 乐器密度、人声与情绪是否贴合；输入风格词不是精确编曲指令。 |
| 只改一句歌词 | 原风格、seed、其余歌词 | 咬字与句子是否自然，是否更容易记住；不保证该句一定出现在 35 秒内。 |
| 只换 seed | 原风格、完整歌词、35 秒设置 | 另一个结果中有没有更合适的旋律或组织方式；不把一次差别当作稳定规律。 |

<p>先完整听，再针对问题重听。用一句话记录偏好，比如“B 的人声更清楚，但 A 的结尾更自然”。保留原结果，避免凭记忆比较。</p>

## 3. 在同一个 Project 里试下一份 {#run}

<p>在正式 Web 的“音乐生成”选择上一候选的“用这次输入继续探索”，更新一个输入，再生成、试听并记录判断。旧 Candidate 和 Version 不会被覆盖。想保留明确选定的旋律并改变风格时，使用<a href="./edit-score.md#regenerate">乐谱页的重新生成</a>，它会保留选定 ABC 与来源父版本。需要下载文件和脚本时再使用下面的补充，每次选择新的输出目录。</p>

<details class="creator-supplement"><summary>当前操作入口：继续使用同一 Project</summary>

<p>此命令示范“只换 seed”。替换 Project id；继续读取第一章的受控歌词。它写入新 Job 并下载新 Candidate，尚不保存 Version。若要换风格，替换 <code>--style</code>。若要改歌词，将原文件复制到自己的新 UTF-8 文件，修改一句，再把新文件路径传给 <code>--lyrics-file</code>；保留原歌词与其他输入。</p>

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py generate --project-id <PROJECT_ID> --style "English, gentle folk pop, warm clear voice, acoustic guitar and piano, light bass and drums, 96 BPM" --lyrics-file services/api/examples/creator/morning-song-lyrics.txt --seed 2026192202 --output-dir data/morning-candidate-02
```

**只换风格：更轻的钢琴编曲。** 保留原歌词与 seed，使用新的下载目录。这个灵感配方尚未试听。

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py generate --project-id <PROJECT_ID> --style "English, gentle folk pop, warm clear voice, soft piano, restrained drums, 96 BPM" --lyrics-file services/api/examples/creator/morning-song-lyrics.txt --seed 2026192201 --output-dir data/morning-piano-01
```

**只改一句歌词。** 下面的受控 UTF-8 文件只替换原歌词的第一句。它也是尚未试听的尝试；风格与 seed 保持原样。

<<< ../../services/api/examples/creator/morning-sunlight-lyrics.txt

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py generate --project-id <PROJECT_ID> --style "English, gentle folk pop, warm clear voice, acoustic guitar and piano, light bass and drums, 96 BPM" --lyrics-file services/api/examples/creator/morning-sunlight-lyrics.txt --seed 2026192201 --output-dir data/morning-sunlight-01
```

每次选一个问题，提交其中一条命令；输出目录已存在时使用新的目录名。想写自己的歌词时，保留原示例，把修改后的全文放在自己的 UTF-8 文件中，再用 `--lyrics-file` 选择它。

</details>

## 4. 选择你想留下的那一个 {#save}

<p>比较下载的音频与 ABC 后，选择同一 Project 的 Candidate。名字记录本次变化，比如“Morning · seed 02”。可以把第一章喜欢的 Version 作为 parent，保留从哪个作品出发；这只是创作来源关系，不表示音频做了局部编辑。</p>

<p>没有喜欢的也可以暂不保存。生成完成不等于创作选择已完成。</p>

<details class="creator-supplement"><summary>当前保存入口：为新 Candidate 建立 Version</summary>

<p>替换实际 Project、Candidate 与已保存父 Version id。没有父版本时移除 <code>--parent-version-id</code> 参数。所有 id 必须属于这个 Project。</p>

```powershell
uv run --project services/api --no-sync python services/api/examples/generate_save.py save --project-id <PROJECT_ID> --candidate-id <NEW_CANDIDATE_ID> --name "Morning - seed 02" --parent-version-id <FIRST_VERSION_ID>
```

</details>

## 如果保存提示冲突，先读取已有版本 {#recovery}

<p>保存命令返回 <code>409</code> 时，CLI 只显示 HTTP 状态与地址，不显示错误响应中的既有 Version id。先在本地 Swagger 用 <code>GET /projects/{project_id}/versions</code> 读取这个 Project 的版本列表，按本次的 <code>candidate_id</code> 查找已保存记录。找到时核对实际 <code>name</code> 与 <code>parent_version_id</code>，记录返回的 Version <code>id</code>，再用 <code>GET /projects/{project_id}/versions/{version_id}</code> 确认已经留下的结果。有新的创作意图时生成新的 Candidate。若列表没有对应记录，保留 Candidate id 与错误，按<a href="./resources.md">保存与素材恢复指南</a>核对其他保存失败原因。</p><p>如果只是等待断开，先按第一章查询原 Job，避免重复推理。下一轮只改一个维度，给比较保留清楚的起点。</p>

## 下一轮可以问什么？ {#next}

<ul><li>让同一个主题的歌词更简短：只改一句，看看表达是否更直接。</li><li>让乐器描述更克制：删掉一项编曲要求，观察是否更接近你的重点。</li><li>从<a href="./reference.md">参考旋律</a>中找一个节奏观察，用文字表达新的风格目标。</li></ul><p>这些都是尝试建议，不是经过调优的成品配方。持续保留输入、Job、试听笔记与选中的 Version，创作会更容易接着做。</p>
