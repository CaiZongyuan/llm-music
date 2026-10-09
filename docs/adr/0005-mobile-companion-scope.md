---
status: accepted
date: 2026-10-09
---

# ADR-005：保留 Web，新增 Android 便携客户端阶段

在已有 Web 工作台之后新增 React Native 移动端阶段，保留 Web 并共用 FastAPI 所拥有的创作数据。首版聚焦“发起生成 → 试听 Candidate → 创作者明确保存 Version”，优先验收 Android；完整乐谱编辑、转谱、Cover 与版本比较继续使用 Web，iOS 验收另行规划。选择便携客户端而非首版复制完整工作台，是为了先验证移动场景中的完整创作闭环，控制第二套客户端的实现与验收成本。

这一范围在 2026-10-09 的 `grill-with-docs` 首轮访谈中确认，并取代 [生产规划](../production.md) 原先对移动端的排除。后续访谈确认局域网手工配对、前台试听、手机保留草稿、Expo Go 优先开发与独立 APK 交付，并要求模拟器、至少一台 Android 真机及实际 APK 验收；用户纠正开发环境为纯 Windows。细项见 [访谈记录](../design/mobile-interview.md) 与 [ADR-006](0006-mobile-lan-pairing.md)。用户于 2026-10-10 授权先初始化 mobile 并试跑，技术结果见 [初始化验证](../verification/mobile-bootstrap.md)；完整业务客户端尚未实现。
