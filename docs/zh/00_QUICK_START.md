# 00 快速开始：启动 DeepScientist 并运行第一个 Quest

这份文档面向第一次使用 DeepScientist 的用户，目标是让你从安装直接走到“成功启动并跑起来一个 quest”。

你只需要完成四步：

1. 安装 DeepScientist
2. 启动本地运行时
3. 在首页创建一个新 quest
4. 从 quest 列表重新打开已有任务

本文中的截图直接使用当前在线页面 `deepscientist.cc:20999` 作为示例。你本地运行后的页面 `127.0.0.1:20999` 通常会与它保持一致或非常接近。

## 1. 安装

先全局安装 Codex 和 DeepScientist：

```bash
npm install -g @openai/codex @researai/deepscientist
```

如果你后续还要在本地编译论文 PDF，也可以顺手安装轻量级 LaTeX 运行时：

```bash
ds latex install-runtime
```

## 2. 启动 DeepScientist

启动本地 daemon 与 Web 工作区：

```bash
ds
```

默认情况下，网页会运行在：

```text
http://127.0.0.1:20999
```

如果浏览器没有自动打开，就手动访问这个地址。

## 3. 认识首页

启动完成后，先打开 `/` 首页。

![DeepScientist 首页](../images/quickstart/00-home.png)

首页故意做得很简单，核心只有两个按钮：

- `Start Research`：创建一个新的 quest，并立刻启动新的研究任务
- `List Quest`：打开已有 quest 列表，重新进入已经存在的任务

如果你是第一次使用，建议先从 `Start Research` 开始。

## 4. 使用 Start Research 创建新 Quest

点击 `Start Research`，会弹出启动表单。

![Start Research 弹窗](../images/quickstart/01-start-research.png)

这个弹窗不只是“新建任务”，它还会为 agent 写入本次研究的启动合同。

最重要的字段是：

- `Quest ID`：通常会自动按顺序生成，例如 `00`、`01`、`02`
- `Primary request` / 研究目标：你真正希望 agent 完成的科研任务
- `Reuse Baseline`：可选；如果你要复用已有 baseline，就在这里选择
- `Research intensity`：本次研究的投入强度
- `Decision mode`：`Autonomous` 表示除非真的需要审批，否则 agent 默认持续自主推进
- `Research paper`：是否要求本次任务同时产出论文式结果
- `Language`：本次运行希望使用的用户侧语言

第一次测试时，建议你这样填写：

- 写一个清晰、单一的研究问题
- 如果还没有 baseline，就先留空
- 强度选择 `Balanced` 或 `Sprint`
- 决策模式保持 `Autonomous`

最后点击弹窗底部的 `Start Research` 即可正式启动。

## 5. 使用 List Quest 打开已有任务

点击首页上的 `List Quest`，会打开 quest 列表。

![List Quest 弹窗](../images/quickstart/02-list-quest.png)

这个列表适合以下场景：

- 重新进入一个已经在运行中的 quest
- 打开一个以前已经完成或已经创建过的 quest
- 按 quest 标题或 quest id 搜索目标任务

列表中的每一行都对应一个 quest 仓库。点击对应卡片即可进入该 quest 的工作区。

## 6. 打开 Quest 之后会发生什么

创建或打开 quest 后，DeepScientist 会进入这个 quest 的工作区页面。

通常你会在里面做这些事情：

1. 在 Copilot / Studio 中观察 agent 的实时进展
2. 查看文件、笔记和生成出来的 artifact
3. 在 Canvas 中理解当前 quest 的图结构与阶段进展
4. 只有在你明确想中断时，才主动停止任务

## 7. 常用运行命令

查看当前状态：

```bash
ds --status
```

停止当前本地 daemon：

```bash
ds --stop
```

如果启动异常或环境有问题，运行诊断：

```bash
ds doctor
```

## 8. 下一步该看什么

- [01 设置参考：如何配置 DeepScientist](./01_SETTINGS_REFERENCE.md)
- [02 Start Research 参考：如何填写科研启动合同](./02_START_RESEARCH_GUIDE.md)
- [03 QQ 连接器指南：如何用 QQ 与 DeepScientist 沟通](./03_QQ_CONNECTOR_GUIDE.md)
- [05 TUI 使用指南：如何使用终端界面](./05_TUI_GUIDE.md)
