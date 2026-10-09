# UI 方向探索记录(视觉重设计)

- 日期:2026-10-09 起。
- 背景:用户决定视觉重做,更换全新方向(关键词:艺术感、黑色系,后收窄为黑白)。原已确认的暖纸+墨绿皮肤(见 `31-web-mvp-preview.md`、`39`、`43`、`46`、`65` 各记录)自本轮起退役,其布局与流程确认继续有效。
- 流程遵循 AGENTS.md:方向稿为静态 HTML,选定后再交付完整交互预览(关键操作可执行、空/加载/失败态、模拟数据隔离),确认后才实现 `apps/web`。样机内容与 `docs/production.md` #33 锁定的工作台布局一致。

## 第一轮 — `docs/previews/ui-direction/`

| 方向 | 结果 |
| --- | --- |
| A 深夜厂牌(宋体编辑 + 朱红) | 用户喜欢,曾作为后续基调 |
| B 酸性硬件(荧光绿机能) | 尚可 |
| C 暮色氛围(暖光渐变) | 花里胡哨,淘汰 |

用户当时要求:更多黑白、更艺术的候选。

## 第二轮 — `docs/previews/ui-direction-2/`

黑白四方向(均继承 A 的宋体编辑气质):D 白盒画廊 / E 海报排印 / F 暗房胶片 / G 纸上画廊(白纸黑墨,供对照)。

结果:对比后用户回到第一轮的 **B 酸性硬件**(「更有个性」),黑白系列未采纳。

## 最终方向:B 酸性硬件(Acid Hardware)

- 状态:**方向已确认**;token 见 `docs/previews/ui-acid-v1/README.md`。
- 完整交互预览:[`docs/previews/ui-acid-v1/`](../previews/ui-acid-v1/index.html)(关键操作可执行,空/加载/失败态,数据仅内存;作者已经浏览器实测,过程记录在该目录 README)。
- 2026-10-09 确认:用户选定 Acid Hardware(「更有个性」),并决定**仅保留黑色主题**(移除浅色主题与切换);改造规格已发布为 [#96 SPEC-014](https://github.com/CaiZongyuan/llm-music/issues/96)(带 `ready-for-agent`)。测试接缝:既有 E2E 断言不变 + 新增 token 契约测试 + 实现后真实浏览器对照验收。
- 品牌资产(2026-10-09/10):主 logo = 中文「声间」字标 `apps/docs/public/images/logo-wordmark-zh.webp`;拉丁字标 `logo-wordmark.webp`(README.md 头图);标志 `logo-mark.webp`(小尺寸图标形态)。生成草稿经多轮筛选后,两张字标因生成图存在像素级噪点/粘连,最终以系统字体(Arial Black / 微软雅黑 Bold 加粗 / Consolas Bold)程序化重建,任意尺寸干净;favicon 由标志几何重绘为 SVG,web 与文档站共用 `public/favicon.svg`。细节见同名 `*.provenance.json`;生成原始 PNG 与提示词在 `output/imagegen/`(gitignored)。
