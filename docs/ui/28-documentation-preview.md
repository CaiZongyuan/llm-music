# #28 文档预览确认记录

- 预览：`documentation-v1`，位于 [预览目录](../previews/documentation-v1/README.md)。
- 票据：[#28](https://github.com/CaiZongyuan/llm-music/issues/28)，规格 [SPEC-013](../specs/SPEC-013-documentation-delivery.md)。
- 内容与源码基线：`236eee2ec2b7fc0ca66b53ebea5c679dec736190`。
- 状态：**已确认**。用户已授权按此版本继续正式 Astro/Starlight、共享 pnpm 命令与章节生成。
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

用户在查看精确版本 `9ae306cae070df46da28c0dacceb21ced6356f6e` 的实时预览后，回答：**“认可，继续正式文档实现（推荐）”**。Root 将该实际答案传递给 #28 的同一 Developer。该答案确认本记录中的导航、语言、主题与信息架构范围；正式站按此版本实施，原 `documentation-v1` 预览保持不变。

## 正式站对照

正式 Astro 7.3.6 / Starlight 0.42.5 文档站沿用六个双语章节、三个任务入口、侧栏、本页内容与明确的教程链。中英文共用稳定小节 id。原预览的七个文件没有修改。

2026-10-07，Developer 在 `pnpm docs:dev` 和静态构建的真实 Chromium 中对照验证：章节跳转、小节语言保持、主题刷新记忆、Ctrl+K 搜索、MIDI 结果跳转、空结果清空、真实搜索索引请求失败后 Retry、缺失章节恢复，以及代码复制。Root 独立对照了概览布局、三类入口、导航与小节语言切换，并发现英文 Copy 控件仍显示中文。

该缺陷由 Starlight 英文 Expressive Code 字符串缺失后继承默认中文引起；现已补齐明确的英文资源。三页六个英文复制按钮的标签与成功消息均通过实际 DOM 读取，点击后显示 `Copied!`。构建检查覆盖各注册语言的复制控件，并纳入配置/翻译的 Markdown 渲染输入标记，防止缓存保留旧翻译。曾尝试的自定义 locale callback 与临时日志已删除。

正常流程没有未捕获 JavaScript 异常；网络访问只包含文档 HTML、静态资源与本地搜索 JSON。受控失败只中断该 JSON。通用 404 页使用默认中文，可以通过站点标题回到概览；部署入口的静态重定向经明确 URL 等待后抵达相应概览。截图与失败记录保存在同一 owned scratch 目录，最终 source commit 与构建读取由候选提交后的验证记录核对。
