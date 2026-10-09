# 片段长度用户可选 — max_seconds 0–360(默认自动)

Baseline: `5631c140ebed5bd0cda1150f9f3229a42eb6d8a4`(main);片段长度实现随本轮工作树交付,
验证完成时尚未提交。规格与决策记录:[#97](https://github.com/CaiZongyuan/llm-music/issues/97);
范围跟随锁定的
YuE2 插件(fc78df9,`max_seconds` 0–360,0 = 自动),默认值「自动」,输出契约
`1 <= duration <= (362 if max_seconds == 0 else max_seconds + 2)`。

## 公共行为

`Generate` / `GenerateFromScore` / `Cover` 的 `max_seconds` 从 `Literal[35]` 放开为
`int, default 0, ge=0, le=360`:0 = 自动(跟随歌词,模型下限约 40 秒),1–360 = 显式上限
秒数(UI 引导 5–360;1–4 在 API 层合法但不推荐)。Runtime 透传请求值,不再强制 35;
输出校验按请求上限收口,超上限报 422 `generated_audio_profile_mismatch`。
已固定的 35 秒 CPU fixture 字节不变(`flac_fixture(0)` 与 `flac_fixture(35)` 同为
1,679,936 帧),既有证据哈希不受影响;Web 三个生成入口共用「片段长度」输入,
空 = 自动,越界本地拒绝。历史 P0 的 30–40 秒闸门记录(`docs/verification/p0-*`)不改写。

## CPU 证据

- `services/api` 全量 pytest:**233 passed**(8 分 54 秒),含新增默认 0、361 → 422、
  超 60 秒上限失败、fake 按 60 秒请求输出 ≈60 秒等用例。
- `pnpm test:web`(web-generation 全量):**20 passed**,含默认提交 0、输入 2 本地拒绝、
  改 60 提交 60 的完整 UI 流。
- 浏览器九套件全绿:generation 4、jobs 14、runtime 4、score 12、score-generation 16、
  cover 31、transcription 1、version-compare 17、version-branches 8、gate 1。
  其中 score-generation / cover / version-branches 的旧断言从 35 改为 0
  (fixture 字节安全,见上)。
- `pnpm docs:check` 全绿:生成镜像与 API 参考反映
  `"max_seconds": {"type": "integer", "maximum": 360, "minimum": 0}`,无 `"const": 35` 残留。
- `@llm-music/api-client` 重新生成后 check 与测试通过(6 passed)。

## 真机 GPU 证据(本轮,串行 owner)

环境:本机 RTX 3070 Ti Laptop 8GB;`runtime/comfyui/manage.py doctor` 12/12 通过
(票据 `.scratch/clip-length/doctor2.json`,sha256 `ae3b48bf6b7da88b…`);owner receipt
按 `python -m music_api.runtime_evidence collect` 收集(PID 绑定,yue2-bf16 与
sheetsage2-bf16 全文件 SHA256 ready;票据 `runtime-evidence.json`,sha256
`0f6184342d311fa2…`)。真实模式 API 以
`MUSIC_API_RUNTIME_MODE=comfyui`、`MUSIC_API_DATA_DIR=.scratch/clip-length/app-data`、
`MUSIC_API_RUNTIME_EVIDENCE_PATH=…` 启动;本次会话显式设置
`MUSIC_API_DIAGNOSTICS_MAX_AGE_SECONDS=3600`(默认 300 秒),如实记录。

| 档位 | 请求 | Job | 实测时长(FLAC STREAMINFO) | API 报告时长 | 判定 |
| --- | --- | --- | --- | --- | --- |
| 显式上限 60s | `max_seconds: 60` | `21eb7343…`(项目 `95b97cab…`) | 55.758667 s | 55.758667 s | PASS(≤ 62 s) |
| 自动 | 省略 `max_seconds` | `a07e300a…`(项目 `8242fc7e…`) | 53.918667 s | 53.918667 s | PASS(≤ 362 s) |

两个 FLAC 均为 48 kHz 立体声;文件 sha256 与数据库记录一致
(60s:`b80a0af9…`,5,104,544 字节;auto:`1419fa21…`,4,701,860 字节)。
两档输出时长不同,证明自动档跟随歌词而非固定值;API 报告时长与独立 STREAMINFO
解析一致。票据:`.scratch/clip-length/real-60s.json`、`real-auto.json`、
`real-session.json`(sha256 分别为 `70499bf9…` 及生成时写入值)。

## 中断与恢复记录

第一轮 auto 档推理进行中,系统内存告急强制停止了 Runtime、API、生成任务与一次
浏览器套件重跑(四个后台任务)。60 秒档已完成,其事实从隔离的应用数据目录
(`app.sqlite` 只读读取 + 资产文件直接 STREAMINFO 解析)恢复并重写票据。经所有者
确认后重启 Runtime(owner receipt 按 PID 42380 重新收集)与 API,重跑 auto 档通过。
被中断的旧 auto 任务(job `ecc39b31…`)按设计保留为
`recovery_required`,显式取消返回 409 `cancellation_ownership_unverified`
(所有权无法向已不存在的运行时确认),不阻塞新任务。

## 范围与限制

- 仅验证功能性:时长受控、流程完成、产物可读。未评估不同档位的音乐质量。
- 自动档实测 53.9 秒来自本教程歌词;实际时长受歌词影响,下限约 40 秒、
  硬上限 360 秒是插件常量,不是本应用再保证。
- `max_seconds` 1–4 在 API 层合法,但未做真机用例(文档引导 ≥5)。
- Extend / 续写长曲(Suno 式分段拼接)不在本轮范围。
