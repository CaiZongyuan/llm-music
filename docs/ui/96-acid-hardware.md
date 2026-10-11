# #96 Acid Hardware 实现对照

- 日期：2026-10-10。
- 需求：[SPEC-014 #96](https://github.com/CaiZongyuan/llm-music/issues/96)，用户在本次会话明确要求据此开发。
- 确认来源：[UI 方向记录](ui-direction.md)。2026-10-09 已确认 Acid Hardware、仅黑色主题及既有布局/流程，继续采用该确认；本次不增加流程或交互。
- 对照边界：规格引用的 `docs/previews/ui-acid-v1/` 源码不在当前工作区或可用 Git 历史中。按已发布的 token 表、控件、排版和状态要求对照；不能宣称与缺失原型逐像素一致。
- 保留的可运行交互预览：[正式组件 + 隔离 CPU Fake API](../previews/acid-hardware/README.md)。数据只进入独立 `.artifacts/acid-preview-<uuid>/`；不进入正式存储。
- 实现：统一黑色 token；主按钮、选中对象和波形进度使用酸绿；失败用红，排队和取消中用琥珀；移除主题状态、入口和持久化，保留语言偏好。abcjs 前景与播放标记、WaveSurfer 色彩从同一 token 层读取。
- 实测纠正：中文等宽标签加入中文黑体回退；首页品牌/面包屑不使用整块激活背景；390px 英文长标题与按钮允许正常换行；禁用主按钮和播放器使用禁用色。
- 键盘与动态效果：实际 Tab 焦点为 2px 酸绿；实际运行态脉冲在系统 reduced-motion 下停止；真实浏览器中仍只有一个原生音频实例。
- 审查：规范审查与规格审查独立进行。遗漏的两处中文主题说明已同步；token 字面颜色 fallback 检查及启动中停止预览的问题已修正，审查复核无剩余可执行问题。

执行命令、真实浏览器状态、受控 E2E、文档检查及限制统一记录在 [验收证据](../verification/acid-hardware.md)。这些记录描述本次实现和实测，不新增用户反馈或确认。
