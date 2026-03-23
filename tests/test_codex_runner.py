from __future__ import annotations

import json

from deepscientist.runners import CodexRunner, RunRequest
from deepscientist.runners.codex import _tool_event


def test_codex_tool_event_preserves_parseable_bash_exec_payload_and_metadata() -> None:
    long_log = "\n".join(f"line {index}" for index in range(600))
    result_payload = {
        "bash_id": "bash-123",
        "status": "completed",
        "command": "sed -n '1,220p' /tmp/example.txt",
        "workdir": "",
        "cwd": "/tmp/quest",
        "log": long_log,
        "exit_code": 0,
    }
    event = {
        "type": "item.completed",
        "item_type": "mcp_tool_call",
        "item": {
            "type": "mcp_tool_call",
            "id": "tool-123",
            "server": "bash_exec",
            "tool": "bash_exec",
            "status": "completed",
            "arguments": {
                "mode": "read",
                "id": "bash-123",
                "workdir": "/tmp/quest",
            },
            "result": {
                "structured_content": result_payload,
                "content": [{"type": "text", "text": json.dumps(result_payload, ensure_ascii=False)}],
            },
        },
    }

    rendered = _tool_event(
        event,
        quest_id="q-001",
        run_id="run-001",
        skill_id="baseline",
        known_tool_names={},
        created_at="2026-03-21T00:00:00Z",
    )

    assert rendered is not None
    assert rendered["type"] == "runner.tool_result"
    assert len(rendered["output"]) > 1200
    parsed_output = json.loads(rendered["output"])
    assert parsed_output["structured_content"]["bash_id"] == "bash-123"
    assert parsed_output["structured_content"]["log"] == long_log
    assert rendered["metadata"]["bash_id"] == "bash-123"
    assert rendered["metadata"]["command"] == "sed -n '1,220p' /tmp/example.txt"
    assert rendered["metadata"]["cwd"] == "/tmp/quest"


def test_codex_tool_event_carries_bash_id_from_id_only_monitor_call() -> None:
    event = {
        "type": "item.started",
        "item_type": "mcp_tool_call",
        "item": {
            "type": "mcp_tool_call",
            "id": "tool-456",
            "server": "bash_exec",
            "tool": "bash_exec",
            "status": "in_progress",
            "arguments": {
                "mode": "await",
                "id": "bash-456",
                "workdir": "/tmp/quest",
                "timeout_seconds": 75,
            },
        },
    }

    rendered = _tool_event(
        event,
        quest_id="q-001",
        run_id="run-001",
        skill_id="baseline",
        known_tool_names={},
        created_at="2026-03-21T00:00:00Z",
    )

    assert rendered is not None
    assert rendered["type"] == "runner.tool_call"
    assert json.loads(rendered["args"])["id"] == "bash-456"
    assert rendered["metadata"]["bash_id"] == "bash-456"
    assert rendered["metadata"]["mode"] == "await"
    assert rendered["metadata"]["timeout_seconds"] == 75


def test_codex_runner_omits_model_flag_when_request_uses_inherit(temp_home) -> None:  # type: ignore[no-untyped-def]
    runner = CodexRunner(
        home=temp_home,
        repo_root=temp_home,
        binary="codex",
        logger=object(),  # type: ignore[arg-type]
        prompt_builder=object(),  # type: ignore[arg-type]
        artifact_service=object(),  # type: ignore[arg-type]
    )
    request = RunRequest(
        quest_id="q-001",
        quest_root=temp_home,
        worktree_root=None,
        run_id="run-001",
        skill_id="baseline",
        message="hello",
        model="inherit",
        approval_policy="on-request",
        sandbox_mode="workspace-write",
        reasoning_effort="xhigh",
    )

    command = runner._build_command(request, "prompt", runner_config={})

    assert "--model" not in command
