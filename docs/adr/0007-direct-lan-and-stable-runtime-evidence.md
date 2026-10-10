---
status: accepted
date: 2026-10-11
---

# ADR-007：局域网自用直接连接，未变更的模型验证不按时钟失效

用户明确纠正单用户局域网自用流程：手机输入电脑地址即可连接，不要求 PIN、设备授权或定时重新校验模型。这一决策取代 [ADR-006](0006-mobile-lan-pairing.md) 的产品连接流程。FastAPI 继续拥有同一套 Project、Asset、Job、Candidate 与 Version；手机保存电脑地址、服务器身份、创作草稿和未确认请求，HTTP、WebSocket 与原始音频都从 FastAPI 的局域网入口直接访问，ComfyUI 继续监听本机。

实际 Runtime 进程、监听、源码和模型文件仍与原验证匹配时，原有模型及源码校验结果继续用于 readiness，经过五分钟本身不构成失败。保留真实来源时间与 age，不通过重写时间冒充再次校验；已确认的稳定事实使用 `max_age_seconds: null`。实际进程/监听或配置改变、源码不匹配、模型文件缺失/变化/校验失败、Runtime 不可达仍需如实报告；动态健康、节点与 GPU 观测继续使用其实际来源和有限观测时间。地址直连不改变创作写入的持久请求 key、结果未知先读取原请求、明确保存 Version 及前台试听规则。

这次变更由用户直接授权实施，新的[可运行预览](../previews/mobile-lan-direct-v1/index.html)先交付，纠正原话和范围见 [UI 记录](../ui/mobile-lan-direct.md)。旧配对预览、历史 APK 和真实 GPU 收据保留其原时点；不能把它们改称为已验证直连。当前修订由 [#113](https://github.com/CaiZongyuan/llm-music/issues/113) 跟踪；物理 Android 与最终直连 APK 验收继续单独取证。
