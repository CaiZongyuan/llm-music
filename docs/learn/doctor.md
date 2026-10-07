准备完成后，保存启动前检查结果，再启动仅监听本机的 Runtime。Doctor 就绪与完整 P0 验收是不同的事实。

## 保存启动前检查 {#save}

<p>在仓库根目录执行。只有 Doctor 退出 <code>0</code> 后才启动服务。<code>--no-sync</code> 保证检查不触发依赖下载或环境修改。</p>

<<< ../../runtime/comfyui/examples/save-readiness.ps1

## 启动本地服务 {#launch}

<<< ../../runtime/comfyui/examples/start.ps1

<p>服务仅监听 <code>http://127.0.0.1:8188</code>，不会自动打开 Canvas。保持此终端运行；用 Ctrl+C 停止。</p><p>Doctor 检查空闲端口。服务启动后，转谱工具复用保存的真实成功 receipt，不在占用端口上重新制造就绪结果。</p>

## 检查边界 {#checks}

<p>Doctor 检查真实 BF16 CUDA 运算、目标设备、锁定版本、节点与推理 imports、重采样、完整模型 SHA256、磁盘和端口。</p><div class="callout"><strong>READY 只表示推理前提就绪</strong><p>Doctor 不加载完整权重，也不证明音乐质量。其 <code>p0_passed=false</code> 不由一次 readiness 检查改写。</p></div>

## 遇到失败时 {#recovery}

<table><thead><tr><th scope="col">检查结果</th><th scope="col">恢复动作</th></tr></thead><tbody><tr><td>模型 missing / downloading</td><td>执行 download-models；保留的 .part 会续传。</td></tr><tr><td>SHA256 或文件大小不符</td><td>保留或移走损坏文件，再重新下载；命令不自动覆盖 invalid 文件。</td></tr><tr><td>端口被占用</td><td>确认占用者。停止自己的服务，或为 Doctor 与 start 选择同一个空闲 --port。</td></tr><tr><td>probe 超时或非零退出</td><td>读取 last_stage、stdout_tail、stderr_tail，解决对应阶段后重试。</td></tr></tbody></table>

<p><a href="./quickstart.md">返回环境准备</a>，或在成功启动后<a href="./transcribe.md">执行第一次转谱</a>。</p>

