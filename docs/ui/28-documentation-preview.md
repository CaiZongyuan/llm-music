# #28 文档预览确认记录

- 预览：`documentation-v1`，位于 [预览目录](../previews/documentation-v1/README.md)。
- 票据：[#28](https://github.com/CaiZongyuan/llm-music/issues/28)，规格 [SPEC-013](../specs/SPEC-013-documentation-delivery.md)。
- 内容与源码基线：`236eee2ec2b7fc0ca66b53ebea5c679dec736190`。
- 状态：**待用户确认**。正式 Astro/Starlight、共享 pnpm 命令与章节生成尚未开始。
- 最新用户纠正：Swagger UI 不再录屏；此预览不包含 Swagger，不产生录屏。

## 待确认体验

三种任务入口：“第一次运行”“理解项目架构”“按任务查阅”。左侧稳定章节导航，右侧本页内容，底部明确的前后章。语言切换保留章节与小节，主题支持浅色、深色与系统。Runtime 已验证能力与 P1/P2 后续交付分别标明。

本地搜索可以执行结果跳转、清空无结果、失败重试。侧栏中的“预览搜索状态”只影响模拟搜索；所有文档命令仅能复制。页面不连接真实 Runtime 或业务写入。

## 实际验证

2026-10-07，Developer 在真实 Chromium 中使用 `agent-browser` 验证桌面 1440 × 1000。Root 随后独立检查了 1440 × 960 的预览。以下结果均已实际读取：

| 操作 | 结果 |
| --- | --- |
| 概览任务入口与章节链 | 快速开始 → Doctor → 转谱可跳转，转谱上一章回到 Doctor。 |
| 同章节语言切换 | `zh/doctor/recovery` 切换到 `en/doctor/recovery`，正文与小节对应。Root 另验证 `quickstart/models` 对应切换。 |
| 刷新与主题 | 英文 Doctor 小节刷新后路由与深色主题保留；Root 另验证浅色主题刷新保留。 |
| 正常搜索 | Ctrl+K 打开；MIDI 结果可跳转到英文转谱；Esc 关闭。 |
| 无结果恢复 | 不匹配关键词显示无结果；清空后恢复三个起点链接。 |
| 搜索加载、失败 | 加载状态可保持并完成；失败后 Retry 恢复文档结果。 |
| 内容文件失败 | 只中断预览 `content.json` 请求；页面显示失败。撤销中断后点击重试恢复正文。 |
| 不存在章节 | 显示找不到章节，并可回到概览。 |
| 命令复制 | 复制 Doctor 命令后显示 Command copied；没有执行命令。 |
| 来源 | 九个固定 GitHub 正文/源码路径均存在于基线提交；六条唯一命令与该提交的双语指南一致。 |
| 隔离与浏览器异常 | 正常流程只请求预览静态文件；控制失败恢复前后均无未捕获 JavaScript 异常。未连接业务 API、Runtime 或 GPU。 |

Developer 的一条 CSS 属性选择器查找失败，改用新 accessibility snapshot 中的元素引用后跳转成功。原失败记录保留，未将它当作产品缺陷或删除失败证据。

验证记录保存在本 worktree 的 `.scratch/p1-development/28-documentation/`：`browser-receipt.json`、`source-check.json`，以及 `overview-light.png`、`overview-en-dark.png`、`search-failure.png`。截图是静态文档预览，Runtime 操作没有执行。

预览仍由自己的 Node PID `53716` 提供，只监听 `127.0.0.1:18028`；保留服务供用户查看。确认前仅交付预览，不把静态样本声明为正式文档站、GitHub Pages 发布或新 GPU 验证。

## 用户反馈

尚未收到本版本的确认。用户对之前音乐与展示的正向反馈属于之前的 PR 产物，不自动确认本文档导航预览。
