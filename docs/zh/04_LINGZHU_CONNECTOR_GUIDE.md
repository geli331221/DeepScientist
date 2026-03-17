# 04 Lingzhu 连接器指南：如何配置 Lingzhu

本文说明如何在 `Settings > Connectors > Lingzhu` 中完成 Lingzhu 伴生端点配置。

适用范围：

- 仅包含配置教程
- 面向 OpenClaw 兼容的 Lingzhu bridge 参数
- 本地健康检查与 SSE 冒烟测试
- 说明需要把哪些值填回 Lingzhu 平台

本文不展开讨论云部署架构。你只需要：

- 一个已经跑起来的 OpenClaw gateway
- 一个眼镜端可访问的公网 IP 或公网域名

参考来源：

- Rokid 论坛配置页面：https://forum.rokid.com/post/detail/2831
- 仓库内置 bridge 目录：`assets/connectors/lingzhu/openclaw-bridge`
- 仓库内置 OpenClaw 配置模板：`assets/connectors/lingzhu/openclaw.lingzhu.config.template.json`

## 1. DeepScientist 现在会自动提供什么

Lingzhu 设置卡会自动生成并校验：

- 本地 health URL
- 本地 SSE URL
- 公网 SSE URL
- `auth_ak`
- OpenClaw 配置片段
- 本地探测 `curl`

当前随包 bridge 还额外做了三件事：

- 在模型真正开始生成前，先自动发送一条可见的“已收到”回执
- 保留 SSE 注释心跳
- 在上游长时间静默时补发轻量可见进度心跳

需要明确的是：

- Lingzhu 在 DeepScientist 里被视为 companion endpoint
- 它不是像 QQ 那样的完整双向聊天 connector

## 2. 开始前请先确认

建议先确认下面几项：

- DeepScientist 已成功安装并运行
- 本地 OpenClaw gateway 已启动
- 你知道 OpenClaw HTTP gateway 的端口，通常是 `18789`
- 你已经有公网 IP 或公网域名

重要提醒：

- `127.0.0.1` 只能用于本地健康检查
- Lingzhu 设备侧必须访问公网地址

## 3. 打开设置页

打开：

- `Settings > Connectors > Lingzhu`

页面会分成几块：

- 网关端点
- 鉴权与身份
- 自动生成值
- 探测与校验
- 高级调试

![Lingzhu 设置概览](../images/lingzhu/lingzhu-settings-overview.svg)

## 4. 先填写端点

推荐值如下：

| 字段 | 推荐值 | 说明 |
| --- | --- | --- |
| `Enabled` | `true` | 开启 companion 配置 |
| `Transport` | `openclaw_sse` | 固定值，不要改 |
| `Local host` | `127.0.0.1` | 只用于本地探测 |
| `Gateway port` | `18789` | 与 OpenClaw gateway 保持一致 |
| `Public base URL` | `http://<公网IP>:18789` | 必须是眼镜端真正能访问到的地址 |

如果你不确定本地端点应该怎么填，可以直接点击：

- `Use local defaults`

## 5. 生成 AK 和身份值

建议如下：

| 字段 | 推荐值 |
| --- | --- |
| `Auth AK` | 点击 `Generate AK` 自动生成 |
| `Agent ID` | `main` |
| `Lingzhu system prompt` | 可选 |

需要保证下面两处完全一致：

- OpenClaw Lingzhu 插件配置
- Lingzhu 平台配置

也就是：

- `auth_ak`
- `agent_id`

## 6. 使用自动生成值

DeepScientist 会直接展示你需要复制的内容：

- 本地 health URL
- 本地 SSE URL
- 公网 SSE URL
- OpenClaw 配置片段
- 探测 curl

其中真正要填回 Lingzhu 平台的是：

- 公网 SSE URL
- AK

![Lingzhu 平台填写值](../images/lingzhu/lingzhu-platform-values.svg)

## 7. 更新 OpenClaw

你可以直接使用：

- 设置页里自动生成的配置片段
- 或仓库内置模板 `assets/connectors/lingzhu/openclaw.lingzhu.config.template.json`

内置 bridge 的安装命令为：

```bash
openclaw plugins install ./assets/connectors/lingzhu/openclaw-bridge
```

至少应确保 OpenClaw 开启：

```json
{
  "gateway": {
    "port": 18789,
    "http": {
      "endpoints": {
        "chatCompletions": {
          "enabled": true
        }
      }
    }
  }
}
```

DeepScientist 也会自动把完整的 Lingzhu 插件配置片段生成出来：

![OpenClaw 配置片段](../images/lingzhu/lingzhu-openclaw-config.svg)

## 8. 执行本地探测

保存参数后，点击：

- `Run Lingzhu probe`

DeepScientist 会依次执行：

1. `GET /metis/agent/api/health`
2. `POST /metis/agent/api/sse`

理想结果：

- `Connection = reachable`
- `Auth = ready`
- 探测结果没有报错

## 9. 需要填回 Lingzhu 平台的值

只需要填：

- `Public SSE URL`
- `Auth AK`

不要填：

- `127.0.0.1`
- 任意本地机器名

## 10. 常见失败原因

### Health 显示 offline

通常说明：

- OpenClaw 没启动
- `gateway_port` 填错
- `local_host` 填错

### SSE probe 失败

通常说明：

- `auth_ak` 不一致
- Lingzhu SSE 路径没有暴露出来
- OpenClaw 的 `chatCompletions.enabled` 还没打开

### 本地探测通过，但设备仍无法接入

通常说明：

- `Public base URL` 不是公网可达地址
- 防火墙或反向代理还没有放行端口

## 11. 说明

这块配置保持 registry-first：

- Lingzhu 仍然落在 `connectors.yaml`
- 自动生成值来自同一份 structured config
- 校验、测试、前端渲染都消费同一条 connector 记录

对于长任务，更稳妥的实际策略是：

- 先由 bridge 自动回执
- 在上游静默阶段由 bridge 补发可见进度心跳
- 通过 `per_user` 会话连续保持多轮上下文

这会明显改善兼容性，但仍不能消除 Lingzhu 平台单次请求超时的硬限制。
