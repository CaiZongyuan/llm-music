# 移动端便携工作台交互预览

日期：2026-10-10。用户在 Android/iPhone Expo Go 初始化连接成功后授权继续开发。沿用三轮已确认范围、最新黑色 Acid Hardware 和“声间”品牌，先交付新工作流的可运行预览。

## 预览范围

源码保留在 [mobile-workbench-v1](../previews/mobile-workbench-v1/README.md)，通过 Expo Router `/preview` 在 Android/iOS Expo Go 和网页使用同一套代码。桌面端开启入口、短码有效期及设备撤销由同目录 `computer.html` 单独演示。模拟数据仅在内存，无真实 API/数据库/凭据写入；历史 MP3 音频附原有来源记录。

覆盖手机配对、新建/打开 Project、风格歌词/Seed/时长、Job 观察与取消重试、未知结果核对、前台试听/seek、Candidate 明确保存 Version、历史、草稿保留，以及配对/任务/保存/连接/项目读取的空/加载/失败与恢复。

## 当前验证与待确认

Root 在实际 Chromium 完成错误/正确配对、新建、时长边界、生成、试听/跳转、未知保存核对与版本历史；补充项目空/加载/读取失败→重读、断连后的试听禁用与撤销后的恢复禁用。电脑 HTML 的开启、模拟失败、完成、撤销及短码过期边界通过。

Android Expo Go + Maestro 的最终完整 Candidate→试听→明确保存→Version 历史通过（103 秒）；取消确认中断→查询原任务→明确重试→保存响应丢失→核对原保存通过（103 秒）。非作者 Standards/Spec 审阅发现的五项问题已修复并复核，最终 SeekBar 替代也通过局部复核。SDK 57 Go 的带标签 Switch 原生宽度错误保留失败记录，平台控件修复后的原恢复流程通过。原生进度条的实际拖动到达 26 秒，原位置断言通过；具体失败与验证边界见 [验证记录](../verification/mobile-workbench-preview.md)。

2026-10-10，用户在收到完整可运行预览入口、验证结果及接入真实后端的确认请求后回复“确认”。本轮小屏界面、操作流程和电脑配对入口确认完成，进入正式规格发布与业务实施；沿用当前预览的最终控件兼容修复。实施安排见 [实施草案](../design/mobile-delivery-plan-draft.md) 和 [API 草案](../design/mobile-api-plan-draft.md)。此确认不将模拟行为记为真实业务 API、GPU、原始 FLAC、持久恢复或 APK 验收。

确认版本的体验入口：原 Expo 首页“打开移动创作预览”，或 [扫码直接进入](../previews/mobile-workbench-v1/evidence/preview-qr.png)；演示配对码 `246810`。预览继续保持模拟数据隔离，正式客户端单独接入真实 API。
