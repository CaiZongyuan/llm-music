在仓库根目录执行。准备完成后，你会得到 Runtime READY，再进入启动与转谱。

## 开始前 {#prerequisites}

<ul><li>Windows x64，RTX 3070 Ti Laptop，标称 8 GiB VRAM。</li><li>已安装 Git、uv 与可用的 NVIDIA 驱动。</li><li>模型下载约 9.19 GB；Doctor 另要求 10 GiB 工作余量。</li><li>使用独立的 Python 3.12.13 Runtime 环境。</li></ul><div class="callout"><strong>只在自己的就绪环境执行</strong><p>这些命令会准备代码、下载依赖与模型。真实 GPU 请求须由当前 resource owner 串行运行。</p></div>

## 1. 准备锁定环境 {#prepare}

<p>命令克隆锁定的 Runtime 与自定义节点，并安装锁文件中的依赖。已有 checkout 必须匹配锁定提交，且没有 tracked 修改。</p>

<<< ../../runtime/comfyui/examples/prepare.ps1

## 2. 准备模型 {#models}

<p>权重保存到 <code>data/models/</code>。YuE2 与 SheetSage2 权重采用 CC-BY-NC-4.0；代码许可独立记录。</p>

<<< ../../runtime/comfyui/examples/download-models.ps1

## 3. 得到就绪结果 {#ready}

<<< ../../runtime/comfyui/examples/doctor.ps1

<p>成功输出 <code>Runtime READY</code>，退出码为 <code>0</code>。失败输出 <code>Runtime NOT READY</code>，退出码为 <code>1</code>，并给出逐项恢复动作。</p><p>如果模型下载中断，重新执行 <code>download-models</code> 续传。<code>.part</code> 文件不算就绪。</p>

## 下一步 {#next-step}

<p>阅读 Doctor 的检查边界，再保存启动前 receipt、启动本地服务并执行转谱。</p><p><a href="./doctor.md">检查并启动 Runtime →</a></p>

