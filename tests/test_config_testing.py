from __future__ import annotations

import json
from pathlib import Path

from deepscientist.bridges import register_builtin_connector_bridges
from deepscientist.config import ConfigManager
from deepscientist.daemon.app import DaemonApp
from deepscientist.home import ensure_home_layout


def test_config_show_includes_help_markdown_and_testability(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    app = DaemonApp(temp_home)

    payload = app.handlers.config_show("connectors")

    assert payload["document_id"] == "connectors"
    assert payload["meta"]["system_testable"] is True
    assert "Connector Settings Guide" in payload["meta"]["help_markdown"]
    assert isinstance(payload["meta"]["structured_config"], dict)
    assert "telegram" in payload["meta"]["structured_config"]


def test_default_config_removes_report_palette_settings_and_keeps_qq_media_policy(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()

    config_payload = manager.load_named("config")
    connectors_payload = manager.load_named("connectors")

    assert "reports" not in config_payload

    assert connectors_payload["qq"]["auto_send_main_experiment_png"] is True
    assert connectors_payload["qq"]["auto_send_analysis_summary_png"] is True
    assert connectors_payload["qq"]["auto_send_slice_png"] is True
    assert connectors_payload["qq"]["auto_send_paper_pdf"] is True
    assert connectors_payload["qq"]["enable_file_upload_experimental"] is False


def test_config_normalization_strips_legacy_report_palette_block(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()

    normalized = manager._normalize_named_payload(
        "config",
        {
            **manager.load_named("config"),
            "reports": {
                "default_palette": "mist-stone",
                "qq_summary_palette": "sage-clay",
                "paper_figure_palette": "mist-stone",
            },
        },
    )

    assert "reports" not in normalized


def test_connectors_config_test_uses_system_probe(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")
    connectors["telegram"]["enabled"] = True
    connectors["telegram"]["bot_token"] = "telegram-token"

    def fake_http_json(url: str, **kwargs):  # noqa: ANN001
        assert "getMe" in url
        return {"ok": True, "result": {"username": "DeepScientistBot"}}

    monkeypatch.setattr("deepscientist.config.service.ConfigManager._http_json", staticmethod(fake_http_json))

    import yaml

    result = manager.test_named_text("connectors", yaml.safe_dump(connectors, sort_keys=False), live=True)

    assert result["ok"] is True
    assert result["items"]
    item = result["items"][0]
    assert item["name"] == "telegram"
    assert item["details"]["identity"] == "DeepScientistBot"


def test_connectors_config_validate_lingzhu_requires_auth_ak_and_warns_about_public_base_url(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")
    connectors["lingzhu"]["enabled"] = True
    connectors["lingzhu"]["gateway_port"] = 18789

    result = manager.validate_named_payload("connectors", connectors)

    assert result["ok"] is False
    assert any("lingzhu: requires `auth_ak`" in item for item in result["errors"])
    assert any("public_base_url" in item for item in result["warnings"])


def test_config_test_api_route_returns_items(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    app = DaemonApp(temp_home)

    def fake_test_named_text(name: str, content: str, *, live: bool = True):  # noqa: ANN001
        return {
            "ok": True,
            "name": name,
            "summary": "Config test completed.",
            "warnings": [],
            "errors": [],
            "items": [{"name": "git", "ok": True, "warnings": [], "errors": [], "details": {"installed": True}}],
        }

    monkeypatch.setattr(app.config_manager, "test_named_text", fake_test_named_text)

    payload = app.handlers.config_test({"name": "config", "content": json.dumps({}), "live": True})

    assert payload["ok"] is True
    assert payload["items"][0]["name"] == "git"


def test_connectors_config_test_supports_lingzhu_probe(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")
    connectors["lingzhu"]["enabled"] = True
    connectors["lingzhu"]["auth_ak"] = "abcd1234-abcd-abcd-abcd-abcdefghijkl"
    connectors["lingzhu"]["gateway_port"] = 18789
    connectors["lingzhu"]["public_base_url"] = "http://203.0.113.10:18789"

    monkeypatch.setattr(
        manager,
        "_probe_lingzhu_health",
        lambda config, timeout=5.0: {"ok": True, "status": "ok", "payload": {"status": "ok"}},
    )
    monkeypatch.setattr(
        manager,
        "_probe_lingzhu_sse",
        lambda config, timeout=8.0: {"ok": True, "content_type": "text/event-stream", "preview": "event: message\\ndata: {}"},
    )

    result = manager.test_named_payload("connectors", connectors, live=True)

    assert result["ok"] is True
    item = next(entry for entry in result["items"] if entry["name"] == "lingzhu")
    assert item["details"]["transport"] == "openclaw_sse"
    assert item["details"]["endpoint_url"] == "http://127.0.0.1:18789/metis/agent/api/sse"
    assert item["details"]["public_endpoint_url"] == "http://203.0.113.10:18789/metis/agent/api/sse"
    assert "authAk" in str(item["details"]["generated_openclaw_config"])
    assert "autoReceiptAck" in str(item["details"]["generated_openclaw_config"])
    assert "visibleProgressHeartbeat" in str(item["details"]["generated_openclaw_config"])
    assert "Authorization: Bearer" in str(item["details"]["generated_curl"])


def test_config_save_validate_and_test_accept_structured_connectors(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    app = DaemonApp(temp_home)

    structured = manager.load_named("connectors")
    structured["telegram"]["enabled"] = True
    structured["telegram"]["bot_token"] = "telegram-token"

    def fake_http_json(url: str, **kwargs):  # noqa: ANN001
        assert "getMe" in url
        return {"ok": True, "result": {"username": "DeepScientistBot"}}

    monkeypatch.setattr("deepscientist.config.service.ConfigManager._http_json", staticmethod(fake_http_json))

    save_payload = app.handlers.config_save("connectors", {"structured": structured})
    assert save_payload["ok"] is True

    validate_payload = app.handlers.config_validate({"name": "connectors", "structured": structured})
    assert validate_payload["ok"] is True

    test_payload = app.handlers.config_test({"name": "connectors", "structured": structured, "live": True})
    assert test_payload["ok"] is True
    assert test_payload["items"][0]["name"] == "telegram"


def test_structured_connector_test_passes_delivery_targets(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    app = DaemonApp(temp_home)

    structured = manager.load_named("connectors")
    structured["telegram"]["enabled"] = True
    structured["telegram"]["bot_token"] = "telegram-token"

    def fake_http_json(url: str, **kwargs):  # noqa: ANN001
        return {"ok": True, "result": {"username": "DeepScientistBot"}}

    monkeypatch.setattr("deepscientist.config.service.ConfigManager._http_json", staticmethod(fake_http_json))

    deliveries: list[tuple[dict, dict]] = []

    class FakeBridge:
        def deliver(self, outbound: dict, config: dict) -> dict:  # noqa: ANN001
            deliveries.append((outbound, config))
            return {"ok": True, "transport": "direct"}

    monkeypatch.setattr("deepscientist.bridges.get_connector_bridge", lambda name: FakeBridge())

    payload = app.handlers.config_test(
        {
            "name": "connectors",
            "structured": structured,
            "live": True,
            "delivery_targets": {
                "telegram": {
                    "chat_type": "direct",
                    "chat_id": "12345",
                    "text": "老师您好，这是一条主动发送测试。",
                }
            },
        }
    )

    assert payload["ok"] is True
    assert deliveries
    outbound, config = deliveries[0]
    assert outbound["conversation_id"] == "telegram:direct:12345"
    assert outbound["text"] == "老师您好，这是一条主动发送测试。"
    assert config["bot_token"] == "telegram-token"


def test_connectors_config_test_supports_qq_direct_without_callback_url(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")
    connectors["qq"]["enabled"] = True
    connectors["qq"]["app_id"] = "1903299925"
    connectors["qq"]["app_secret"] = "qq-secret"

    def fake_http_json(url: str, **kwargs):  # noqa: ANN001
        if url == "https://bots.qq.com/app/getAppAccessToken":
            assert kwargs["method"] == "POST"
            assert kwargs["body"] == {"appId": "1903299925", "clientSecret": "qq-secret"}
            return {"access_token": "qq-access-token", "expires_in": 7200}
        if url == "https://api.sgroup.qq.com/gateway":
            assert kwargs["headers"]["Authorization"] == "QQBot qq-access-token"
            return {"url": "wss://api.sgroup.qq.com/websocket"}
        raise AssertionError(url)

    monkeypatch.setattr("deepscientist.config.service.ConfigManager._http_json", staticmethod(fake_http_json))

    import yaml

    result = manager.test_named_text(
        "connectors",
        yaml.safe_dump(connectors, sort_keys=False),
        live=True,
        delivery_targets={"qq": {"chat_type": "direct", "chat_id": "", "text": ""}},
    )

    assert result["ok"] is True
    item = result["items"][0]
    assert item["name"] == "qq"
    assert item["details"]["transport"] == "gateway_direct"
    assert item["details"]["gateway_url"] == "wss://api.sgroup.qq.com/websocket"
    assert not any("public_callback_url" in warning for warning in item["warnings"])
    assert not any("target chat id is empty" in warning for warning in item["warnings"])


def test_connectors_config_test_uses_recent_qq_conversation_as_default_target(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")
    connectors["qq"]["enabled"] = True
    connectors["qq"]["app_id"] = "1903299925"
    connectors["qq"]["app_secret"] = "qq-secret"

    qq_state_root = temp_home / "logs" / "connectors" / "qq"
    qq_state_root.mkdir(parents=True, exist_ok=True)
    (qq_state_root / "state.json").write_text('{"last_conversation_id":"qq:direct:openid-123"}', encoding="utf-8")

    def fake_http_json(url: str, **kwargs):  # noqa: ANN001
        if url == "https://bots.qq.com/app/getAppAccessToken":
            return {"access_token": "qq-access-token", "expires_in": 7200}
        if url == "https://api.sgroup.qq.com/gateway":
            return {"url": "wss://api.sgroup.qq.com/websocket"}
        raise AssertionError(url)

    monkeypatch.setattr("deepscientist.config.service.ConfigManager._http_json", staticmethod(fake_http_json))

    deliveries: list[tuple[dict, dict]] = []

    class FakeBridge:
        def deliver(self, outbound: dict, config: dict) -> dict:  # noqa: ANN001
            deliveries.append((outbound, config))
            return {"ok": True, "transport": "qq-gateway-direct"}

    monkeypatch.setattr("deepscientist.bridges.get_connector_bridge", lambda name: FakeBridge())

    import yaml

    result = manager.test_named_text(
        "connectors",
        yaml.safe_dump(connectors, sort_keys=False),
        live=True,
        delivery_targets={"qq": {"chat_type": "direct", "chat_id": "", "text": "测试消息"}},
    )

    assert result["ok"] is True
    assert deliveries
    outbound, _config = deliveries[0]
    assert outbound["conversation_id"] == "qq:direct:openid-123"
    item = result["items"][0]
    assert item["details"]["delivery_target"]["used_default_target"] is True
    assert not any("target is empty" in warning for warning in item["warnings"])


def test_connectors_config_test_queues_whatsapp_local_session_delivery(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")
    session_dir = temp_home / "whatsapp-session"
    connectors["whatsapp"]["enabled"] = True
    connectors["whatsapp"]["transport"] = "local_session"
    connectors["whatsapp"]["session_dir"] = str(session_dir)
    connectors["whatsapp"]["group_policy"] = "open"
    register_builtin_connector_bridges()

    import yaml

    result = manager.test_named_text(
        "connectors",
        yaml.safe_dump(connectors, sort_keys=False),
        live=True,
        delivery_targets={
            "whatsapp": {
                "chat_type": "direct",
                "chat_id": "15550001111@s.whatsapp.net",
                "text": "老师您好，这是一条本地 session 测试消息。",
            }
        },
    )

    assert result["ok"] is True
    item = next(entry for entry in result["items"] if entry["name"] == "whatsapp")
    assert item["details"]["delivery"]["transport"] == "whatsapp-local-session"
    outbox_path = session_dir / "outbox.jsonl"
    assert outbox_path.exists()


def test_plugins_structured_config_normalizes_legacy_search_paths(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)

    payload = manager.validate_named_payload(
        "plugins",
        {
            "search_paths": ["/tmp/plugins"],
            "enabled": ["plugin-a"],
        },
    )

    assert payload["ok"] is True
    normalized = payload["parsed"]
    assert normalized["load_paths"] == ["/tmp/plugins"]
    assert normalized["enabled"] == ["plugin-a"]
    assert normalized["disabled"] == []
    assert normalized["allow_unsigned"] is False


def test_mcp_structured_config_normalizes_list_and_validates_required_fields(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)

    payload = manager.validate_named_payload(
        "mcp_servers",
        {
            "servers": [
                {
                    "name": "browser",
                    "enabled": True,
                    "transport": "stdio",
                    "command": ["npx", "@example/browser-mcp"],
                    "env": {"TOKEN": "secret"},
                },
                {
                    "name": "papers",
                    "enabled": True,
                    "transport": "streamable_http",
                    "url": "https://example.com/mcp",
                },
            ]
        },
    )

    assert payload["ok"] is True
    normalized = payload["parsed"]
    assert normalized["servers"]["browser"]["command"] == ["npx", "@example/browser-mcp"]
    assert normalized["servers"]["papers"]["url"] == "https://example.com/mcp"


def test_runners_config_test_executes_live_codex_probe(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    runners = manager.load_named("runners")
    runners["codex"]["enabled"] = True
    runners["codex"]["binary"] = "codex"

    monkeypatch.setattr("deepscientist.config.service.resolve_runner_binary", lambda binary, runner_name=None: "/tmp/fake-codex")
    monkeypatch.setattr(
        manager,
        "_probe_codex_runner",
        lambda config: {
            "ok": True,
            "summary": "Codex startup probe completed.",
            "warnings": [],
            "errors": [],
            "details": {
                "resolved_binary": "/tmp/fake-codex",
                "stdout_excerpt": '{"item":{"text":"HELLO"}}',
            },
        },
    )

    result = manager.test_named_payload("runners", runners, live=True)

    assert result["ok"] is True
    codex = next(item for item in result["items"] if item["name"] == "codex")
    assert codex["details"]["resolved_binary"] == "/tmp/fake-codex"
    assert codex["details"]["live_probe_executed"] is True
    assert codex["details"]["stdout_excerpt"]


def test_codex_bootstrap_probe_persists_success_state(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()

    monkeypatch.setattr(
        manager,
        "_probe_codex_runner",
        lambda config: {
            "ok": True,
            "summary": "Codex startup probe completed.",
            "warnings": [],
            "errors": [],
            "details": {
                "binary": "codex",
                "resolved_binary": "/tmp/fake-codex",
                "model": "gpt-5.4",
                "approval_policy": "on-request",
                "sandbox_mode": "workspace-write",
                "reasoning_effort": "xhigh",
                "checked_at": "2026-03-15T10:00:00+00:00",
                "exit_code": 0,
                "stdout_excerpt": '{"item":{"text":"HELLO"}}',
                "stderr_excerpt": "",
            },
            "guidance": [],
        },
    )

    result = manager.probe_codex_bootstrap(persist=True)
    state = manager.codex_bootstrap_state()

    assert result["ok"] is True
    assert state["codex_ready"] is True
    assert state["codex_last_checked_at"]
    assert state["codex_last_result"]["summary"] == "Codex startup probe completed."


def test_codex_bootstrap_probe_persists_failure_state(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()

    monkeypatch.setattr(
        manager,
        "_probe_codex_runner",
        lambda config: {
            "ok": False,
            "summary": "Codex startup probe failed.",
            "warnings": ["Codex returned stderr during the startup probe."],
            "errors": [
                "Codex did not complete the startup hello probe successfully.",
                "Run `codex` once and complete login before starting DeepScientist.",
            ],
            "details": {
                "binary": "codex",
                "resolved_binary": "/tmp/fake-codex",
                "model": "gpt-5.4",
                "approval_policy": "on-request",
                "sandbox_mode": "workspace-write",
                "reasoning_effort": "xhigh",
                "checked_at": "2026-03-15T10:00:00+00:00",
                "exit_code": 1,
                "stdout_excerpt": "",
                "stderr_excerpt": "Please login first",
            },
            "guidance": ["Run `codex` in a terminal and complete login or first-run setup."],
        },
    )

    result = manager.probe_codex_bootstrap(persist=True)
    state = manager.codex_bootstrap_state()

    assert result["ok"] is False
    assert state["codex_ready"] is False
    assert "Please login first" in state["codex_last_result"]["stderr_excerpt"]
