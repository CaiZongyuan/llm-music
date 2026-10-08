创作教程围绕结果展开。环境准备、Doctor、API 与开发资料在这里按需查阅，现有指南继续可达。

## 先让实际操作入口就绪 {#prepare}

<p>如果已有由你或管理者维护的就绪本地环境，直接进入创作教程。首次使用则先准备 Runtime、模型与应用 API；需要 Git、uv 和受支持的 NVIDIA GPU。现有指南给出完整命令、锁定版本与恢复方法。</p><p>真实模式使用独立应用数据目录和新鲜 owner receipt。不要把 fake 的项目目录切换成真实模式；fake 只适合练习应用行为，不产生模型音乐。</p>

- [环境、模型、Doctor 与 Runtime 启动](../guides/runtime-doctor.md)
- [本地 Web 启动、项目与参考素材](../guides/web-workspace.md#launch)
- [用一条命令启动本地工作台](../guides/dev-launcher.md)
- [应用 API 启动与生成/保存操作](../guides/generate-save-api.md)
- [真实 Runtime 诊断收据与刷新](../reference/runtime-evidence.md)

## 遇到问题时，先找对应任务 {#help}

- [上传格式、文件预算与素材恢复](../guides/api-project-audio.md)
- [Web 任务取消、明确重试与断线恢复](../guides/web-jobs.md)
- [Web 创作准备、模型与只读设置](../guides/web-runtime.md)
- [转谱输入范围与 ABC/MIDI 结果](../guides/api-transcription.md)
- [取消、明确重试与错误处理](../guides/api-cancel-retry.md)
- [实时阶段、断开后读取同一 Job](../guides/api-job-events.md)
- [Runtime 与模型就绪问题](../guides/api-runtime-diagnostics.md)

## 需要开发或更深入的控制 {#advanced}

<p>当前 Swagger 在你自己运行的应用地址 <code>/docs</code>；<code>/openapi.json</code> 是 API 合同。源码与架构资料服务于接入和维护，不作为创作教程的必修章节。下方链接固定到当前接口基线。</p>

- [架构与领域边界](architecture.md)
- [源码：现成生成与保存 CLI](../../services/api/examples/generate_save.py)
- [源码：公开生成与保存参数](../../services/api/src/music_api/generation_schemas.py)
- [文档站维护与运行](../guides/documentation.md)

## 回到你的创作任务 {#back}

<p><a href="./first-music.md">做第一段音乐 →</a> · <a href="./reference.md">从参考音频开始 →</a> · <a href="./variations.md">探索新玩法 →</a></p>

## 现成 CLI 的完整源码 {#cli-source}

<details class="creator-supplement"><summary>按需查阅：生成与保存工具</summary>

<<< ../../services/api/examples/generate_save.py

</details>
