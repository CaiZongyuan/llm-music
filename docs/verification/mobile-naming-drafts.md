# 手机未提交名称的持久草稿

2026-10-10。[SPEC-017 #99](https://github.com/CaiZongyuan/llm-music/issues/99) 要求保留正在编辑的项目名称与草稿；[M4 #103](https://github.com/CaiZongyuan/llm-music/issues/103) 同时包含 Candidate 命名保存。此前 M3 只持久 CreationDraft 的四个字段与已冻结提交，名称在 prepare 前仅可存在页面内存。

Root 在共享 data 集成边界增加 `getTitleDraft/updateTitleDraft`，继续使用同一 LocalDocument/SQLite 和现有序列化写入。新项目名称按 server 隔离，Version 名称按 server/project/candidate 隔离；保留原文字与空白，提交时由调用者验证及 trim。输入名称不创建 intent、不调用 HTTP、不换请求键。存储失败保留最新编辑且阻止不可恢复提交；重试存储不会创建 Project 或 Version。

LocalDocument.version1 新增可选 titles 字段，当前 decoder 接受此前没有 titles 的记录，并严格检查标题分区、引用电脑与字符串值。没有业务 API/Pydantic/OpenAPI 变更、第二套存储或设备凭据复制。实际消费者是 M4 的新建和保存表单；M5 媒体、M1/M2 后端及现有 Web 不依赖该字段。旧应用版本对新字段的降级写入不作为支持承诺。

公开 session 首 tracer 在尚无方法时失败：`updateTitleDraft is not a function`；实现后冷重建读取原项目名与 Candidate 版本名，并验证不同 Candidate 的名称隔离，当前 intent0、输入阶段 HTTP0。第二个公开检查覆盖电脑切换、拒写后保留最新名称、存储恢复与禁止自动创建。独立审查发现旧记录的可选标题表会短路读取前提检查；新增公开 guard 检查先得到 `Missing expected exception`，修复为先检查当前电脑及目标后通过。已有23项接口回归继续通过，总计26项通过；应用与测试 TypeScript、shared client build 及 diff 检查通过。

命令在该 worktree 根目录执行：

```powershell
pnpm --filter @llm-music/mobile test
pnpm --filter @llm-music/mobile check:test
pnpm mobile:check
```

证据：该 worktree `.scratch/title-drafts/cold-red.log`、`cold-green.log`、`guard-red.log`、`all-tests.log`。这些检查使用公开 session 与外部存储/网络 provider，证明持久化调用行为，不替代 M4 实际表单冷启动、原生磁盘或物理设备验收。M4 完整界面验收会再次覆盖新项目和 Version 名称保留。独立 Standards 复查确认上述修复，当前没有未解决项；独立 Spec 检查同样没有发现。最终 head CI 与实际集成由 Root 登记。
