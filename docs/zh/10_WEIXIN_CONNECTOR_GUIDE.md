# 10 微信连接器指南：把个人微信绑定到 DeepScientist

这篇文档只讲 DeepScientist 内置的微信连接器，不讲 OpenClaw 安装。

DeepScientist 已经内置了微信 iLink 运行时，因此你不需要再额外执行：

- `npx`
- 单独安装 OpenClaw
- 再起一个本地桥接程序
- 配置公网 webhook

真正需要的绑定动作只有这四步：

1. 打开 `Settings > Connectors > WeChat`
2. 点击 `绑定微信`
3. 用微信扫码
4. 在手机微信里确认登录

确认完成后，DeepScientist 会自动保存微信 connector，并开始长轮询。

## 1. 这个连接器现在能做什么

绑定成功后，DeepScientist 现在可以：

- 接收微信文本消息
- 接收微信图片、视频、文件附件
- 把入站附件复制到当前 quest 的 `userfiles/weixin/...`
- 把文本回复发回同一个微信上下文
- 在 agent 提供真实本地文件时，发送微信原生图片、视频、文件

入站媒体不会只留在临时缓存里，而是会被复制进 quest。本地落盘路径形态如下：

```text
~/DeepScientist/quests/<quest_id>/userfiles/weixin/<message_batch>/
```

这意味着微信附件现在已经比较接近 QQ 的处理方式了：quest 能拿到真实、持久化的本地文件。

![DeepScientist 微信绑定总览](../images/weixin/weixin-settings-bind.svg)

## 2. 绑定前先确认

开始前请先确认：

- DeepScientist 的 daemon 和网页已经正常启动
- 你可以打开 `Settings > Connectors > WeChat`
- 手机上已经登录了一个真实的个人微信账号，准备用它扫码

这张参考图只用于帮助你确认扫码时应使用已经登录目标微信账号的手机。真正的绑定动作仍然是在 DeepScientist 页面里弹出二维码后扫码完成，而不是去跑额外的 `npx` 工具。

![微信客户端参考图](../images/weixin/weixin-plugin-entry.png)

## 3. 从 Settings 页面直接绑定

打开：

- [Settings > Connectors > WeChat](/settings/connectors#connector-weixin)

然后按顺序做：

1. 点击 `绑定微信`
2. 等待 DeepScientist 生成二维码
3. 用微信扫码
4. 在手机上确认登录

这里有几个关键点：

- 弹窗里只保留二维码这一张图，因为 DeepScientist 已经内置了完整的 iLink 登录流程
- 绑定过程中不需要手填 `bot_token`
- 二维码弹窗里不需要额外再点一次保存
- 平台一旦返回 `bot_token` 和账号信息，DeepScientist 会自动持久化

成功后，微信卡片里会显示：

- `机器人账号`
- `扫码账号`

这两项就是当前保存下来的微信绑定信息。

![二维码扫码确认流程](../images/weixin/weixin-qr-confirm.svg)

## 4. 绑定后怎么验证文本和多媒体

二维码登录成功后，建议按这个最短路径验证：

1. 在 `Start Research` 或项目界面把 quest 绑定到微信 connector
2. 从微信发一条文本、图片、视频或文件
3. 等待 DeepScientist 把它接入到 quest
4. 确认回复回到了同一条微信会话里

当前行为是：

- 入站文本会直接进入 quest，作为用户消息
- 入站图片、视频、文件会被下载并复制进 quest 本地 `userfiles/weixin/...`
- 纯媒体消息不会再被直接丢弃
- 出站文本会沿用运行时维护的 `context_token`
- 出站图片、视频、文件在 agent 提供真实本地文件路径时可以正常发送

![Quest 本地多媒体流转](../images/weixin/weixin-quest-media-flow.svg)

## 5. agent 发送微信多媒体时应怎么做

对用户来说，规则其实很简单：

- 只回文本时，正常回复即可
- 要发微信原生图片、视频、文件时，agent 必须给出一个真实的 quest 本地文件

所以 agent 最好优先使用这些目录中的真实文件：

```text
artifacts/...
experiments/...
paper/...
userfiles/...
```

而不是默认依赖一个任意的外链。

## 6. 常见问题

### 二维码一直在等待

优先检查：

- 是否用的是你真正想绑定的那个微信账号扫码
- 手机里是否已经完成“确认登录”
- 等待期间 DeepScientist 是否持续在线

如果二维码过期，DeepScientist 会自动刷新。

### 为什么我只看到文本，没有看到入站多媒体

请用真实图片、视频或文件重测一次。成功后，quest 目录里应该能看到：

```text
userfiles/weixin/<message_batch>/manifest.json
```

以及旁边被复制下来的实际媒体文件。

## 7. 参考

- 菜鸟教程个人微信接入说明：https://www.runoob.com/ai-agent/openclaw-weixin.html
- 上游微信协议文档：https://github.com/hao-ji-xing/openclaw-weixin/blob/main/weixin-bot-api.md
