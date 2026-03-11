from __future__ import annotations

from pathlib import Path

from deepscientist.config import ConfigManager
from deepscientist.daemon import DaemonApp
from deepscientist.home import ensure_home_layout, repo_root
from deepscientist.quest import QuestService
from deepscientist.shared import read_json
from deepscientist.shared import write_yaml
from deepscientist.skills import SkillInstaller


def test_qq_group_requires_binding_and_supports_commands(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    ConfigManager(temp_home).ensure_files()
    quest = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home)).create("qq quest")
    quest_id = quest["quest_id"]
    app = DaemonApp(temp_home)

    ignored = app.handle_qq_inbound(
        {
            "chat_type": "group",
            "group_id": "group-001",
            "sender_id": "user-1",
            "text": "hello team",
        }
    )
    assert ignored["accepted"] is False
    assert ignored["reason"] == "group_requires_mention_or_prefix"

    bound = app.handle_qq_inbound(
        {
            "chat_type": "group",
            "group_id": "group-001",
            "sender_id": "user-1",
            "text": f"/use {quest_id}",
        }
    )
    assert bound["accepted"] is True
    assert quest_id in bound["reply"]["payload"]["text"]
    bindings = app.list_qq_bindings()
    assert any(item["quest_id"] == quest_id for item in bindings)
    quest_bindings = read_json(Path(quest["quest_root"]) / ".ds" / "bindings.json", {"sources": []})
    assert f"qq:group:group-001" in (quest_bindings.get("sources") or [])

    status = app.handle_qq_inbound(
        {
            "chat_type": "group",
            "group_id": "group-001",
            "sender_id": "user-1",
            "text": "@DeepScientist /status",
        }
    )
    assert status["accepted"] is True
    assert quest_id in status["reply"]["payload"]["text"]

    graph = app.handle_qq_inbound(
        {
            "chat_type": "group",
            "group_id": "group-001",
            "sender_id": "user-1",
            "text": "/graph",
        }
    )
    attachments = graph["reply"]["payload"]["attachments"]
    assert attachments
    assert any(Path(item["path"]).exists() for item in attachments if item.get("path"))

    approval = app.handle_qq_inbound(
        {
            "chat_type": "group",
            "group_id": "group-001",
            "sender_id": "user-1",
            "text": "/approve decision-001 Looks good to proceed",
        }
    )
    assert "Approval recorded" in approval["reply"]["payload"]["text"]


def test_qq_direct_message_starts_in_help_mode_and_auto_binds_to_newest_quest(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")
    connectors["qq"]["enabled"] = True
    connectors["qq"]["app_id"] = "1903299925"
    connectors["qq"]["app_secret"] = "qq-secret"
    connectors["qq"]["auto_bind_dm_to_active_quest"] = True
    write_yaml(manager.path_for("connectors"), connectors)
    older_quest = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home)).create("older qq quest")

    deliveries: list[dict] = []

    def fake_deliver(_self, payload, _config):  # noqa: ANN001
        deliveries.append(dict(payload))
        return {"ok": True, "transport": "qq-http"}

    monkeypatch.setattr("deepscientist.bridges.connectors.QQConnectorBridge.deliver", fake_deliver)
    app = DaemonApp(temp_home)

    first = app.handle_qq_inbound(
        {
            "chat_type": "direct",
            "sender_id": "user-2",
            "sender_name": "Tester",
            "text": "请先更新当前研究计划。",
        }
    )
    assert first["accepted"] is True
    assert older_quest["quest_id"] in first["reply"]["payload"]["text"]
    assert "/use" in first["reply"]["payload"]["text"]
    assert "openid" in first["reply"]["payload"]["text"]
    assert app.quest_service.history(older_quest["quest_id"]) == []
    assert app.list_qq_bindings() == []

    latest = app.create_quest(goal="qq latest quest", source="web")
    latest_id = latest["quest_id"]

    bindings = app.list_qq_bindings()
    assert any(item["conversation_id"] == "qq:direct:user-2" and item["quest_id"] == latest_id for item in bindings)

    sessions = app.sessions.snapshot()
    assert sessions
    assert sessions[0]["quest_id"] == latest_id
    assert any(source.startswith("qq:direct:") for source in sessions[0]["bound_sources"])

    second = app.handle_qq_inbound(
        {
            "chat_type": "direct",
            "sender_id": "user-2",
            "sender_name": "Tester",
            "text": "请先更新当前研究计划。",
        }
    )
    assert second["accepted"] is True
    assert latest_id in second["reply"]["payload"]["text"]

    history = app.quest_service.history(latest_id)
    assert history
    assert history[-1]["content"] == "请先更新当前研究计划。"
    assert history[-1]["source"].startswith("qq:direct:")

    refreshed_connectors = manager.load_named("connectors")
    assert refreshed_connectors["qq"]["main_chat_id"] == "user-2"

    connector_statuses = {item["name"]: item for item in app.handlers.connectors()}
    assert connector_statuses["qq"]["main_chat_id"] == "user-2"
    assert connector_statuses["qq"]["last_conversation_id"] == "qq:direct:user-2"
    assert connector_statuses["qq"]["transport"] == "gateway_direct"
    assert connector_statuses["qq"]["connection_state"] == "ready"
    assert connector_statuses["qq"]["default_target"]["conversation_id"] == "qq:direct:user-2"
    assert any(item["conversation_id"] == "qq:direct:user-2" for item in connector_statuses["qq"]["discovered_targets"])
    assert any(item["text"].startswith("已自动检测并保存当前 QQ openid") for item in deliveries)
    assert any(latest_id in item["text"] for item in deliveries)


def test_qq_direct_message_does_not_overwrite_existing_main_chat_id(temp_home: Path, monkeypatch) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")
    connectors["qq"]["enabled"] = True
    connectors["qq"]["app_id"] = "1903299925"
    connectors["qq"]["app_secret"] = "qq-secret"
    connectors["qq"]["main_chat_id"] = "existing-openid"
    write_yaml(manager.path_for("connectors"), connectors)

    def fake_deliver(_self, _payload, _config):  # noqa: ANN001
        return {"ok": True, "transport": "qq-http"}

    monkeypatch.setattr("deepscientist.bridges.connectors.QQConnectorBridge.deliver", fake_deliver)
    app = DaemonApp(temp_home)

    response = app.handle_qq_inbound(
        {
            "chat_type": "direct",
            "sender_id": "user-3",
            "sender_name": "Tester",
            "text": "你好",
        }
    )

    assert response["accepted"] is True
    assert "existing-openid" == manager.load_named("connectors")["qq"]["main_chat_id"]
    assert "自动检测并保存当前 QQ openid" not in response["reply"]["payload"]["text"]
