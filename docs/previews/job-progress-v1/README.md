# 任务进度展示交互预览

关联 [#98](https://github.com/CaiZongyuan/llm-music/issues/98)（SPEC-016）。这是尚未正式实现的提案预览：真实 GPU 推理期间，任务卡片以「阶段步骤条 + 已用时间」展示整个过程，不伪造整任务百分比。生产现状（阶段文字 + 脉冲动画）与 fake 运行时的数字进度条也一并提供对照。

## 启动

仓库根目录执行；无依赖、无需安装，也不需要 API、数据库或 GPU。

```powershell
pnpm --dir docs/previews/job-progress-v1 run start
```

打开 <http://127.0.0.1:18091/llm-music/job-progress-preview/>。如端口属于其他进程，不停止它；在 `run start` 后传入未占用端口。启动器拒绝 Runtime 8188 与旧预览 18030–18033、18072、18084。

## 可执行操作

1. 「模拟生成」按 Generate 的真实阶段序列（准备 → 加载模型 → 规划乐谱 → 生成音乐结构 → 合成音乐 → 解码音频 → 保存）自动推进，「模拟转谱」按 Transcribe 序列推进；已用时间实时递增。
2. 阶段序列与后端 `OPERATION_PHASES`/`CAPTIONS` 一致；推进间隔是演示值，真实耗时由运行时决定。
3. 「跳到阶段」「在当前阶段失败」「请求取消」覆盖运行中控制；失败展示与生产一致的 `runtime_out_of_memory` 问题框，完成/失败/取消后显示总耗时。
4. 「fake 运行时视角」开关对照现状数字进度条：真实运行时只有已证实的阶段，没有百分比。
5. 右上角切换中/英、亮/暗；任务卡片文案与生产 `jobs/messages.ts` 同源。

## 隔离声明

所有任务数据只存在于页面内存：不访问业务 API、数据库、ComfyUI 或 GPU，刷新即清空。静态服务仅提供本目录文件，CSP `connect-src 'none'`。
