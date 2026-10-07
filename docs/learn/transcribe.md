把原创短音乐送入 SheetSage2。通过 Runtime API 得到可解析的 ABC 与可读取的 MIDI，全程不需要 ComfyUI Canvas。

## 开始前 {#before}

<p>先<a href="./doctor.md">保存 Doctor receipt 并启动 Runtime</a>。在仓库根目录的第二个终端执行以下命令。由当前 GPU resource owner 运行，且 Runtime 队列须为空。</p>

## 运行第一次转谱 {#run}

在自己的就绪环境中使用以下完整示例。

<<< ../../runtime/comfyui/examples/transcribe.ps1

<p>输出目录必须是新目录或空目录。工具默认生成 16 秒、48 kHz、双声道、16-bit PCM 原创器乐 WAV，输入采用 CC0-1.0。</p><p>该命令会上传音频、提交 GPU 推理并保存文件。文档中的复制按钮只复制命令，不执行它。</p>

## 检查你的结果 {#verify}

<p>成功退出 <code>0</code>。打开输出目录，核对 <code>receipt.json</code> 中的 <code>status=completed</code> 与 <code>verified=true</code>。</p>

<table><thead><tr><th scope="col">文件</th><th scope="col">用途</th></tr></thead><tbody><tr><td>reference.wav</td><td>默认固定输入与内容 hash。</td></tr><tr><td>request.json / history.json</td><td>实际提交请求与完整 Runtime 结果。</td></tr><tr><td>score.abc / score.mid</td><td>通过完整解析、MIDI 导出与非空音符读取的产物。</td></tr><tr><td>receipt.json</td><td>输入输出 hash、版本、设置与解析证据。</td></tr></tbody></table>

<p>工具先解析完整 ABC，再导出 MIDI、重新上传并读取实际音符。HTTP 200 或文件存在本身不足以成功。</p>

## 一次失败恢复 {#failure}

<p>如果命令因输出目录非空退出 <code>2</code>，保留已有结果，选择新的输出目录。不要删除旧证据来重复提交。</p><p>如果超过默认 1800 秒 timeout，请求可能仍在运行。先核对保存的请求、history 和 queue，由 owner 决定等待或取消。</p>

## 能力与限制 {#limits}

<p>固定短器乐样本验证流程与文件有效性，不能证明人声或任意音乐的转谱准确率。SheetSage2 权重采用 CC-BY-NC-4.0，与输入的 CC0 许可分开记录。</p><p>诊断输入仅接受非静音、未截断的 16-bit 单/双声道 PCM WAV，时长 0.05–30 秒。该输入预算不是准确率保证。</p><p>重复相同音频可能命中插件独立缓存。仅有 public history 不能证明本次进行了新的 GPU 推理；首次执行日志与 GPU 事实由 owner 保留。</p><p>此工具验证一次 Runtime 路径，<code>p0_passed</code> 保持 <code>false</code>。完整 P0 验收还包含生成、队列、取消、连续任务和清理。</p>
