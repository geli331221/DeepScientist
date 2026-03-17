# QQ Connector Contract

- connector_contract_id: qq
- connector_contract_scope: loaded only when QQ is the active or bound external connector for this quest
- connector_contract_goal: use `artifact.interact(...)` as the main durable user-visible thread on QQ instead of exposing raw internal runner or tool chatter
- qq_reply_style: keep QQ replies concise, milestone-first, respectful, and easy to scan on a phone
- qq_operator_surface_rule: treat QQ as an operator surface for coordination and milestone delivery, not as a full artifact browser
- qq_default_text_rule: plain text is the default and safest QQ mode
- qq_absolute_path_rule: when you request native QQ image or file delivery via an attachment `path`, prefer an absolute path
- qq_failure_rule: if `artifact.interact(...)` returns `attachment_issues` or `delivery_results` errors, treat that as a real delivery failure and adapt before assuming the user received the media

## QQ Runtime Capabilities

- always supported:
  - concise plain-text QQ replies through `artifact.interact(...)`
  - ordinary threaded continuity through DeepScientist interaction threads
  - automatic reply-to-recent-message behavior when the QQ channel has a recent inbound message id for this conversation
- supported only when the active-surface block says the capability is enabled:
  - native QQ markdown send when `qq_enable_markdown_send: True`
  - native QQ image or file send when `qq_enable_file_upload_experimental: True`
- do not assume:
  - inline OpenClaw-style tags such as `<qqimg>...</qqimg>` or `<qqfile>...</qqfile>`
  - quoted-body reconstruction of arbitrary historical QQ messages unless the runtime explicitly exposes it
  - device-side `surface_actions` on QQ

## Structured Usage Rules

- request QQ markdown by setting:
  - `connector_hints={'qq': {'render_mode': 'markdown'}}`
- request native QQ image delivery by attaching one structured attachment with:
  - `connector_delivery={'qq': {'media_kind': 'image'}}`
- request native QQ file delivery by attaching one structured attachment with:
  - `connector_delivery={'qq': {'media_kind': 'file'}}`
- when you are replying inside an ongoing QQ thread, you normally do not need to set any explicit quote field yourself; a normal `artifact.interact(...)` reply will automatically reuse the most recent inbound QQ message id for that conversation when available
- if no native delivery is needed, omit `connector_hints` and `connector_delivery`
- do not invent connector-specific tag syntax in the message body
- do not attach many files to QQ by default; select only the one highest-value image or file for a milestone
- if native media delivery is disabled or fails, fall back to a concise text update and continue the quest unless the missing media blocks the user

## Examples

### 1. Plain-text QQ progress update

```python
artifact.interact(
    kind="progress",
    message="主实验第一轮已经跑完，结果稳定。我正在继续做消融，下一次会同步关键变化。",
    reply_mode="threaded",
)
```

### 2. Continue the current QQ thread with automatic reply context

Use the normal `artifact.interact(...)` call. When DeepScientist already knows the most recent inbound QQ `message_id` for this conversation, the runtime will attach the reply to that thread automatically.

```python
artifact.interact(
    kind="progress",
    message="我已经看完您刚才提到的那篇论文，正在整理它和当前 baseline 的核心差异，稍后给您一个更完整的结论。",
    reply_mode="threaded",
)
```

### 3. QQ markdown summary

Use this only when the active-surface block says `qq_enable_markdown_send: True`.

```python
artifact.interact(
    kind="milestone",
    message="## 主实验完成\n- 指标已稳定超过基线\n- 当前最主要风险是泛化边界仍需补充验证",
    reply_mode="threaded",
    connector_hints={"qq": {"render_mode": "markdown"}},
)
```

### 4. Send one native QQ image

Use this only when the active-surface block says `qq_enable_file_upload_experimental: True`.

```python
artifact.interact(
    kind="milestone",
    message="主实验已经完成。我发一张汇总图给您，便于手机上快速查看。",
    reply_mode="threaded",
    attachments=[
        {
            "kind": "path",
            "path": "/absolute/path/to/main_summary.png",
            "label": "main-summary",
            "content_type": "image/png",
            "connector_delivery": {"qq": {"media_kind": "image"}},
        }
    ],
)
```

### 5. Send one native QQ file

```python
artifact.interact(
    kind="milestone",
    message="论文初稿已整理完成。我把 PDF 一并发给您。",
    reply_mode="threaded",
    attachments=[
        {
            "kind": "path",
            "path": "/absolute/path/to/paper_draft.pdf",
            "label": "paper-draft",
            "content_type": "application/pdf",
            "connector_delivery": {"qq": {"media_kind": "file"}},
        }
    ],
)
```

### 6. If delivery fails

- inspect `attachment_issues`
- inspect `delivery_results`
- if the text part succeeded but the image or file failed, acknowledge the partial failure internally and continue with a concise text-only QQ update unless the missing media is essential
