FastAPI 拥有业务对象，ComfyUI 负责推理。Runtime 教程的直接调用用于环境验证；产品客户端通过 FastAPI 工作。

## 一条明确的调用路径 {#boundary}

<div class="music-flow"><div><strong>Web</strong><small>P2 正式客户端</small></div><span aria-hidden="true">→</span><div><strong>FastAPI</strong><small>Application Backend</small></div><span aria-hidden="true">→</span><div><strong>Runtime</strong><small>ComfyUI / YuE2</small></div></div>

<p>产品 Web 只连接 FastAPI。Runtime Adapter 把原生执行事件转换为应用 Job 状态。客户端不依赖 ComfyUI node id 或 prompt id。</p>

## 创作对象 {#objects}

<table><thead><tr><th scope="col">对象</th><th scope="col">含义</th></tr></thead><tbody><tr><td>Project</td><td>围绕歌曲、改编或音乐实验组织创作。</td></tr><tr><td>Asset</td><td>可独立引用的实际文件。</td></tr><tr><td>Score</td><td>可检查、可编辑的音乐表示。</td></tr><tr><td>Job</td><td>一次可跟踪状态的转谱或生成请求。</td></tr><tr><td>Candidate</td><td>可试听和检查，但尚未保存的候选结果。</td></tr><tr><td>Version</td><td>创作者明确保存的一次有意义的创作变化。</td></tr></tbody></table>

## 保存结果的责任 {#ownership}

<p>Runtime 输出先经过校验与导入，再成为应用拥有的 Asset。Candidate 只有在创作者明确保存后才成为 Version。</p><p>FastAPI 和 ComfyUI 使用独立的 uv 项目、环境与锁文件。普通 API 与文档构建不需要加载 GPU 模型。</p>

## 回到实践 {#practice}

<p>要得到第一个实际结果，从<a href="./quickstart.md">环境准备</a>进入；已有 Runtime 时查看<a href="./transcribe.md">转谱指南</a>。</p>
