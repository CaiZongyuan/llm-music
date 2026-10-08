# Score 编辑与重新生成交互预览

关联 [#39](https://github.com/CaiZongyuan/llm-music/issues/39)、[Score Workspace #9](https://github.com/CaiZongyuan/llm-music/issues/9)。反馈与确认见 [预览记录](../../ui/39-score-preview.md)。这是隔离预览，尚未获得本次交互确认；不是正式 Web editor。

## 启动

在仓库根目录执行。预览使用独立、锁定的 abcjs 依赖，不需要 API、数据库或 GPU。

```powershell
pnpm --dir docs/previews/score-editing-v1 install --ignore-workspace --frozen-lockfile
pnpm --dir docs/previews/score-editing-v1 run start
```

打开 <http://127.0.0.1:18072/llm-music/score-preview/>。如该端口已有其他 owner，不要停止它；可在 `run start` 后传入另一个未占用端口。8188 与旧预览 18030–18033 被启动器拒绝。停止仅属于本次预览的进程。

## 尝试一条创作路径

1. 在“雨后的散步”中，将 Ins 旋律的 `C D E F G2 E2` 改成 `G A B c d2 B2`。谱面会重新检查；“更新谱面”也可立即重试。示例保留 Vocal 的等长休止，先专注修改旋律。
2. 试听草稿 MIDI，再导出它。试听用简单音色检查音高与节奏；每次输出来自当前有效草稿。
3. 点击“选定此 Score”。选定 ABC 和父版本冻结；展开快照可检查文本。
4. 调整风格、歌词或 seed，点击“从选定 Score 生成”。这是模拟 GenerateFromScore。输入快照在点击时冻结，任务只显示阶段和未知进度。
5. 试听 Candidate，再“保存为新版本”。输入名称并明确保存。版本列表保留原始 V1 与新的父子关系。
6. 切到歌词或版本页；底部 Player 继续播放。查看版本快照，确认当前草稿没有改写旧版本。

## 尝试失败与编辑竞态

顶部“检查其他状态”只影响此预览。

- 选择“无效 ABC”，检查错误位置、保留文本与禁止试听、导出和新提交；修正后更新谱面。上一份有效谱面有明确提示，不能冒充当前草稿。
- “下次谱面/试听/导出/生成/保存失败”各影响下一次对应操作一次。重试能恢复；草稿、选定快照和旧 Version 保留。生成重试使用同一原提交输入，并创建新 Job。
- “暂停任务，继续编辑”可暂停正在运行的任务，也可让下一次任务停留。提交后继续改 ABC，在“查看快照”核对本次任务仍使用原选定内容；通过“继续并完成任务”取得 Candidate。
- 草稿变化后，再次生成前须检查并重新选定；正在运行的 Job 不受变化影响。恢复原版本也只改草稿。
- 取消排队/运行任务，或选择“取消时刚好完成”检查实际完成事实。取消不会自动创建 Version。
- “还没有 Score”提供空状态和示例恢复；“重新读取 Score”提供加载状态，保留文本。刷新重置内存，不代表持久恢复。

中文/English 和亮/暗主题可切换。桌面与窄屏都能执行主要操作。

## 真实与模拟边界

真实本地行为：abcjs 6.7.1 解析与 SVG 谱面、从有效 ABC 派生的 Standard MIDI 文件、该 MIDI 音符转换出的 PCM WAV 试听、播放器媒体时钟、seek 与原生下载。试听音色是简单正弦合成；此预览限制为一首 ABC、120 秒和 10,000 个音符以内。解析警告会阻止当前草稿选定与新提交；这不是对所有 Runtime ABC 支持范围的声明。

初始示例采用已验证的 Vocal / Ins 双声部结构；96 BPM、四小节、Ins 22 个音符、Vocal 等长休止。原样与上述修改后的示例均通过 #41 的锁定标准库 ABC 解析器，音乐本体为 10 s，试听附带 0.2 s 尾段。这只核对示例可衔接性，不代替实际推理或任意 ABC 的支持证明。

模拟行为：Project、Score 身份、Job、阶段、失败、Candidate 与 Version 只在页面内存中。模拟 payload 是原型领域数据，不是第二份生产 API 类型。正式客户端仍须从 FastAPI/Pydantic/OpenAPI 生成；正式 GenerateFromScore 的支持边界由对应 API/Runtime 票据验证。

Candidate 与 Version 的音频试听复用 [Web MVP 的已标注历史音乐](../web-mvp-v1/sample-provenance.json)，来源 [PR #58](https://github.com/CaiZongyuan/llm-music/pull/58)。它不代表本次编辑的旋律、推理结果或质量。独立示例 ABC 与历史音频不声称音乐内容对应。

服务只监听 loopback，静态路径使用 allowlist，拒绝 POST，CSP 禁止业务通信。没有真实上传、API 请求、Runtime 调用或业务写入。已安装依赖与本地证据不进入 Git。
