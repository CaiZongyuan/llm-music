# #29 高级参考补充预览

- 票据：[#29](https://github.com/CaiZongyuan/llm-music/issues/29)，父规格 [#13](https://github.com/CaiZongyuan/llm-music/issues/13)。
- 复用确认：[#28 布局与交互](28-documentation-preview.md)、[#65 创作教程方向](65-creator-documentation-preview.md)。创作与多样化玩法继续是主入口。
- 来源基线：`15de0d9e424efaf06e5b75ffc67f57ef32421561`，已集成 P1 的 Pydantic/OpenAPI/client 与重启恢复。
- 可复现补充：[documentation-reference-v1](../previews/documentation-reference-v1/README.md)。
- 状态：**补充预览已交付，正式清单更新等待 Root 确认既有授权或记录新的用户确认。** 不是新的产品 Web，也不是 Pages 发布。

## 可见范围

原来的十个双语章节、创作正文、布局、主题、搜索组件与旧预览保持不变。补充清单仅在“环境与开发资料”追加十二个章节：API 合同参考、应用 Settings 参考，以及直接登记的十个既有高级用法指南。指南正文继续来自 owning Markdown；不会为发布维护第二份教程。

API 与 client 共用 `music-api openapi` CPU 导出。配置生成直接调用现有 `settings_metadata()`，显示真实字段、变量映射、默认值与限制。默认 Path 从 checkout 根目录推导 `${REPOSITORY}/data`，避免将机器绝对路径发布。生成不启动应用 lifespan、不创建业务数据、不连接 Runtime 或 GPU。

主创作入口保留。新参考提供分类索引、结构与字段跳转、用法链接、完整受控示例、对应提交的正文/源码来源。页面和命令只读；不会生成音乐或保存 Version。当前能力限制继续以已交付阶段为准。

## 实际验证与修正

2026-10-07，owned `127.0.0.1:18033` 提供实际 Astro/Starlight 静态预览。Developer 使用独立软件 Chromium session `docs29` 验证新入口、小节跳转、同小节语言切换、主题刷新、生成字段搜索、空结果恢复、受控示例/同语言恢复指南、固定源码链接与创作主导航。Astro 检查为 0 errors / 0 warnings / 0 hints。预览产物包含 44 个登记页面、48 个 HTML；链接、锚点、资源、来源与 Pages base 检查通过。

Root 独立发现 API 的右侧/移动目录把 `{project_id}` 显示为 `${project_id}`；正文标题和合同 JSON 保持正确。实际 DOM 定位证实 Astro 的普通标题提取会添加 `$`。端点标题改为适当的行内代码，保留 canonical 路由文本；静态检查增加目录/index 与真实 h3 的文字一致性断言。该修正属于已交付参考的准确性，不改变体验设计。

证据在 Root `.scratch/p2-development/29-reference/`：CPU 合同/来源检查、浏览器原始动作与 receipt、截图与预览产物检查。首个浏览器 harness 在 JavaScript 模板字符串中把 `${REPOSITORY}` 当作变量，未发出对应浏览器动作；修正验证器的字符串拼接后通过，原失败保留。最初通过 PowerShell 管道传递补充清单时中文标题被编码成问号，正式 Unicode 来源修正并重新构建；既有正文和预览未改变。

这里只记录实际本地预览。用户确认、最终 candidate、正式清单对照与 Pages 发布状态由各实际结果追加。
