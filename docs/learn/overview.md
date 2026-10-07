从本地 Runtime 开始：准备环境、检查就绪状态，再把 16 秒参考音频转成 ABC 与 MIDI。按当前已实现的能力学习。

<div class="hero-actions"><a class="primary-action" href="./quickstart.md">开始准备 →</a><a class="secondary-action" href="./transcribe.md">查看转谱指南</a></div>

<div class="music-flow"><div><strong>参考音频</strong><small>16 秒原创器乐</small></div><span aria-hidden="true">→</span><div><strong>SheetSage2</strong><small>本地 GPU 转谱</small></div><span aria-hidden="true">→</span><div><strong>ABC + MIDI</strong><small>校验完整文件</small></div></div>

## 选择你的起点 {#choose}

<div class="task-grid"><a class="task-card" href="./quickstart.md"><span aria-hidden="true">01</span><strong>第一次运行</strong><p>准备锁定环境与模型，得到第一条 Doctor 检查结果。</p><small>从快速开始进入 →</small></a><a class="task-card" href="./architecture.md"><span aria-hidden="true">02</span><strong>理解项目架构</strong><p>了解 Project、Job 与 Runtime 的边界，再定位源码。</p><small>阅读架构 →</small></a><a class="task-card" href="./transcribe.md"><span aria-hidden="true">03</span><strong>按任务查阅</strong><p>已有就绪 Runtime？直接查看转谱操作、结果与失败恢复。</p><small>转谱并导出 MIDI →</small></a></div>

## 这版文档覆盖什么 {#today}

<p>本站展示 P0 Runtime 的环境准备、Doctor 和第一条转谱路径。真实 GPU 验证已完成；这里不会运行检查或提交音乐任务。</p><p>FastAPI 核心正在按 P1 交付。正式音乐工作台 Web 从 P2 开始，后续产品教程随已实现阶段增加。</p><p><a href="./scope.md">查看当前范围与后续阶段 →</a></p>

## 你的第一个结果 {#result}

<p>转谱工具保留输入、请求与 history，校验完整 ABC，再导出并读取 MIDI。成功的 receipt 包含 <code>status=completed</code> 与 <code>verified=true</code>。</p><p>文件存在或 HTTP 200 本身不代表成功。固定短样本也不能证明任意音乐的转谱准确率。</p>
