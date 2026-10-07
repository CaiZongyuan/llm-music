# 生成与验证 Runtime 文档站

在仓库根目录操作。需要 Node.js 24.18.0 与 pnpm 11.22.0。本文验证环境为 Windows x64，PowerShell 用于隔离示例检查。FastAPI 和 ComfyUI 环境不参与文档生成；以下命令不运行 Doctor、下载权重或提交 GPU 请求。

## 得到可浏览的站点

```powershell
pnpm install --frozen-lockfile
pnpm docs:dev
```

打开 <http://127.0.0.1:18029/llm-music/zh-cn/overview/>。服务只监听本机。Ctrl+C 停止自己的进程；不要占用 Runtime 的 8188 端口。若 18029 被占用，可运行 `pnpm docs:dev --port 18030`。修改正文或清单后重新运行入口，以重新生成内容。

文档按三种任务组织：第一次运行、理解架构、按任务查阅。中文与英文使用同一章节 id 和小节 id；语言切换保留章节及小节。搜索只读取本地生成的章节内容，失败时可以重试，当前正文仍可阅读。

## 修改来源

1. 先阅读 [文档维护规范](../agents/documentation.md)。
2. 在 `docs/learn/` 修改成对的 `.md` 与 `.en.md` 正文。正文不写生成 frontmatter。
3. 在 [章节清单](../site.json) 登记稳定 id、类型、分组、语言标题、正文来源与发布 path。每章两种语言共享 path。只登记已实现范围。
4. 为各语言对应小节使用相同稳定 id，例如 `## 准备模型 {#models}`。前后章必须在清单中显式声明并互相对应；未声明时不自动串联。
5. 教学代码用独立、完整的受控源码文件。正文以 `<<< ../../runtime/comfyui/examples/doctor.ps1` 引用。生成器读取完整文件并附上固定提交的源码链接。

相对文档链接若指向登记章节，会生成同语言站内地址。其他仓库文件转为固定提交的 GitHub 链接。源码引用与仓库链接都检查真实文件路径，拒绝跨越仓库边界的路径和 filesystem link。

`apps/docs/src/content/docs/`、`.generated/`、`.astro/`、`dist/` 与搜索索引为生成产物，留在 Git 外。不要修改生成页面；修改其 owning source，再重新生成。

## 验证与构建

```powershell
pnpm docs:check
pnpm docs:build
pnpm --filter @llm-music/docs preview
```

`docs:check` 校验清单、来源、语言配对、小节、导航、代码引用，运行独立失败场景与 PowerShell 示例的隔离 fake 恢复检查，再运行 Astro 类型检查。`docs:build` 重新生成并构建静态站，检查最终页面、内部链接、锚点、资源、搜索登记与 `/llm-music/` 部署 base。构建检查保留 Starlight 通用 404 页的 canonical/alternate 元数据惯例；其真实导航和资源仍检查。

Runtime 的四个完整连接示例统一接受 `-Port`，默认 8188。选定空闲的 8189 后，Doctor、保存检查结果、启动与第二个终端的转谱都传 `-Port 8189`；转谱会使用 `--base-url http://127.0.0.1:8189`。隔离检查按顺序执行相同受控脚本，确认转谱读取前一步保存的 receipt；无效端口在调用 uv 前被拒绝。具体恢复步骤见双语 Doctor 与转谱章节。

提交后的完整构建显示实际 Git commit 与正文来源，并核对所引用文件确实存在于该 commit。相关源码尚未提交时，页面明确标记“工作副本”；这类产物不表示该版本已发布。GitHub Actions 在准确 head 上运行相同检查并保留静态产物。

缺失翻译、重复 path、非对应的前后章、缺失源码或越界引用会让生成失败。旧页面不会在来源检查失败时被替换。修复 owning source 后重试。静态产物若有失效锚点或资源，修复正文、配置或组件，重新执行 `docs:build`。

## 验证范围

此交付提供 P0 Runtime 文档站基础。真实 GPU 结果复用已验收的 P0 转谱与连续运行记录；示例的新增退出码和 receipt 保护使用隔离 fake 命令验证。没有新的音乐推理、GPU benchmark 或音乐质量结论。

完整 FastAPI 连续教程与生成参考属于 #29，实际 GitHub Pages 发布属于 #30。这里只完成本地构建及 `/llm-music/` 路径准备，没有部署记录就不报告线上发布。正式产品 Web 仍从 P2 开始。
