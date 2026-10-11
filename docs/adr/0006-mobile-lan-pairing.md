---
status: superseded by ADR-007
date: 2026-10-09
---

# ADR-006：移动端通过可撤销配对访问局域网 FastAPI

2026-10-11，用户明确要求局域网单用户自用直接连接，取代本决策的短码、设备凭据与撤销产品流程，见 [ADR-007](0007-direct-lan-and-stable-runtime-evidence.md) 和[纠正记录](../ui/mobile-lan-direct.md)。以下保留 2026-10-09 的历史决策，不作为当前实施要求。

移动端首版连接同一局域网内保持运行的 GPU 电脑，通过手工输入电脑地址与短时配对码建立设备授权，保存设备凭据，并允许电脑撤销配对。继续采用单用户工作台，Project、Asset、Job、Candidate 与 Version 由同一 FastAPI 管理；设备授权需覆盖 HTTP、WebSocket 和音频读取，ComfyUI 仍仅监听本机。这一选择扩大原有 loopback 客户端边界，同时避免首版引入公网访问、账号体系或第二套创作数据；具体入口和凭据机制须单独实现及验收。

该选择在 2026-10-09 的 `grill-with-docs` 第二、三轮访谈中确认；手工配对优先于二维码，以减少首个闭环的实现与自动化验证成本。完整范围与尚未执行的验证步骤见 [访谈记录](../design/mobile-interview.md) 和 [生产规划](../production.md#62-安全边界)。
