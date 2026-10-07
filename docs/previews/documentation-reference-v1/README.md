# 高级参考入口补充预览

复用 #28 与 #65 已确认的 Astro/Starlight 布局、创作教程与主导航。新增内容只位于“环境与开发资料”：从同一 OpenAPI 生成的 API 参考、真实 Settings 配置参考，以及已维护的高级用法指南。所有页面只读，不连接业务 API、Runtime 或 GPU。

在本票独立 checkout 根目录先安装锁定依赖：

```powershell
pnpm install --frozen-lockfile
uv sync --project services/api --locked --python 3.12.13
node docs/previews/documentation-reference-v1/build.mjs
pnpm --filter @llm-music/docs exec astro preview --host 127.0.0.1 --port 18033
```

入口：<http://127.0.0.1:18033/llm-music/zh-cn/api-reference/>。可操作：参考索引/小节跳转、同章节语言切换、主题、搜索与错误重试、受控示例的复制；命令只读，不执行写入。当前主创作入口继续在概览。生成目录与构建产物不入 Git，`amendment.json` 是这次可见入口的可复现补充清单；正式清单在用户确认后更新。
