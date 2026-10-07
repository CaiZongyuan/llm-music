查询高级操作的 HTTP 参数、返回与错误，以及 Job 事件的消息结构。本页的合同区块与 TypeScript client 读取同一 FastAPI / Pydantic OpenAPI 导出；生成时不连接 Runtime。

## 先选一个用法入口 {#usage}

- [生成、试听 Candidate 与明确保存 Version](../guides/generate-save-api.md)
- [参考音频转谱与导出 ABC/MIDI](../guides/api-transcription.md)
- [TypeScript client 与完整受控示例](../guides/api-client.md)
- [Job 事件与 HTTP 恢复](../guides/api-job-events.md)

将路径中的 Project、Asset、Job、Candidate 与 Version id 换成应用实际返回的值。HTTP 下载的媒体类型、multipart 输入、必填值与校验限制都在下方合同中。结构里的 `$ref` 对应“结构索引”。错误结构以已导出的响应为准；业务错误码是开放字符串，用法与恢复见对应指南。

## 来源与能力边界 {#source}

[导出入口](../../services/api/src/music_api/cli.py) 与 [HTTP/事件合同](../../services/api/src/music_api/contracts.py) 为事实来源。[配置参考](settings.md) 说明上传预算与运行模式；文件预算不代表推理时长。创作能力与阶段限制见[当前能力](../learn/scope.md)。本参考不会运行请求、保存 Version 或更新诊断收据。

<<< @openapi
