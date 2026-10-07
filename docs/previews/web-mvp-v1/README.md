# Web MVP 交互预览

票据：[#31](https://github.com/CaiZongyuan/llm-music/issues/31)。接口基线：`15de0d9e424efaf06e5b75ffc67f57ef32421561`。正式 React 实现仍等待本预览的具体确认。

从仓库根目录运行，不安装依赖：

```powershell
node docs/previews/web-mvp-v1/serve.mjs
```

打开 <http://127.0.0.1:18032/llm-music/web-preview/>。停止此进程即可退出。服务仅绑定 localhost，只提供此预览的静态 allowlist 文件，拒绝业务 POST；没有 FastAPI、ComfyUI、GPU、数据库或业务数据目录的连接。需要备用端口时传入 `18033` 等端口，禁止 8188。

## 可以体验的操作

- 在项目列表创建并打开一个项目；用工作区的音乐生成、参考音频、乐谱、歌词与版本标签创作。
- 从风格与歌词提交模拟生成；看到排队/运行/领域阶段；完成后试听候选、查看示例乐谱，再明确保存为版本。重复保存进入同一版本，不产生另一份。
- 上传本地 16 秒 PCM16 mono24k/stereo48k WAV，或加入合成参考示例；实际试听，模拟转谱，查看来源/ABC 并下载合法 MIDI。
- 真实播放、暂停、seek 与片段循环。标签切换不移除 audio 元素。
- 在任务页取消排队/运行任务、查看错误、明确重试；断联后重新读取同一模拟任务，避免重复提交。
- 打开顶部“检查其他状态”，体验空、加载、读取失败、任务失败、保存/播放/下载失败、取消竞态、断联、就绪/缺模型/失联/过期和可测量进度。场景只操作本地内存。

每个任务的公开状态仍只有 queued/running/completed/failed/cancelled。任务阶段没有被换算成伪百分比；只有明确的 fixture 场景可以展示已知数值。

## 数据与音频边界

项目、任务、素材引用、候选与版本只在页面内存中。实际浏览器刷新会重置预览；页面里的“重新读取”演示模拟服务端原身份恢复，不能替代正式持久性验证。hash 可用于同一会话中的工作区导航，刷新重新进入默认示例。

`sample-pr58.mp3` 是已有 PR #58 的真实 YuE2 音乐试听副本，约 34.998667 秒、561,068 B；SHA256 `6c36d74e20f235af77fd60e262ed5533d033c907dc3a3e09aa23ec18b8ca4c4e`。对应历史输入与原 FLAC 来源见 [sample-provenance.json](sample-provenance.json)。修改输入后仍播放同一历史音频，没有新增推理，也不表示这些修改已被模型实现。

`reference-16s.wav` 为离线合成的 C/D/E/F 正弦旋律，16 秒 PCM16 单声道 24 kHz，768,044 B；用于真实上传和播放操作。`preview-score.abc`/`preview-score.mid` 为 C/D/E/F 四个四分音符的独立合法 fixture，120 BPM、2 秒，MIDI format 0、PPQN 480。示意谱面与 ABC/MIDI 音符一致，但没有声称该乐谱来自选中的参考或历史音乐。正式产品将以 abcjs 渲染真实 ABC。

当前页只读查看乐谱与来源；编辑、GenerateFromScore、Cover、A/B 和长曲不作为已经支持的操作。Settings 只读说明配置，正式 API 当前只有 `/settings/metadata`；候选正式恢复可使用已交付 `/projects/{project_id}/candidates` 列表。

用户反馈、具体确认与实际浏览器事实记录在 [预览记录](../../ui/31-web-mvp-preview.md)。此目录保留原型作为体验决策来源；不会直接成为正式产品源码。
