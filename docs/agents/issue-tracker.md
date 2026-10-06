# Issue tracker: GitHub

本仓库的规格与票据发布到 `CaiZongyuan/llm-music` 的 GitHub Issues，使用 `gh` CLI。用户于 2026-10-06 确认该选择和默认分流标签。

## 发布与读取

- 发布规格或票据：先完成技能要求的草案确认，再创建独立 issue，正文使用 `--body-file`。应用 `ready-for-agent` 标签；标签不代表阻塞条件已经满足。
- 读取来源 issue 时，读取完整正文、评论、标签和现有依赖。发布前检查重名与既有记录，避免重复创建。
- 规格作为父 issue，实施票据用原生 sub-issue 关系链接到主要规格；涉及其他规格时，在正文注明。
- 原生依赖：对被阻塞 issue 调用 `POST repos/CaiZongyuan/llm-music/issues/{number}/dependencies/blocked_by`，传入阻塞 issue 的数值数据库 `issue_id`。使用 issue number 查询数据库 id，二者不混用。
- 若平台不支持原生关系，在票据的 `Parent` / `Blocked by` 正文中保留真实 issue 引用，并报告回退。
- 不关闭或改写来源父 issue。规格和票据规划完成不代表产品开发完成。

## 开发前沿

只有所有阻塞票据实际完成、阶段验收通过且没有 owner 的实施票据可以领取。每票一个 owner、branch 和 worktree；跨票 GPU 推理共享一个串行资源 owner。规格父 issue 不作为实施票据领取。

## Pull requests as a request surface

**PRs as a request surface: no.**
