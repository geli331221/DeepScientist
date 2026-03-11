from __future__ import annotations

from pathlib import Path

from deepscientist.config import ConfigManager
from deepscientist.daemon.app import DaemonApp
from deepscientist.home import ensure_home_layout, repo_root
from deepscientist.quest import QuestService
from deepscientist.shared import write_yaml
from deepscientist.skills import SkillInstaller


def test_default_connectors_include_feishu_and_whatsapp(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")

    assert "whatsapp" in connectors
    assert "feishu" in connectors
    assert connectors["whatsapp"]["dm_policy"] == "pairing"
    assert connectors["whatsapp"]["transport"] == "local_session"
    assert connectors["feishu"]["transport"] == "long_connection"
    assert connectors["feishu"]["app_id"] is None


def test_generic_connector_starts_in_help_mode_and_auto_binds_to_newest_quest(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")
    connectors["whatsapp"]["enabled"] = True
    connectors["whatsapp"]["auto_bind_dm_to_active_quest"] = True
    write_yaml(manager.path_for("connectors"), connectors)

    older_quest = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home)).create("whatsapp older quest")
    app = DaemonApp(temp_home)

    first = app.handle_connector_inbound(
        "whatsapp",
        {
            "chat_type": "direct",
            "sender_id": "+15550001111",
            "sender_name": "Researcher",
            "text": "Please summarize the latest result.",
        },
    )
    assert first["accepted"] is True
    assert older_quest["quest_id"] in first["reply"]["payload"]["text"]
    assert "/use" in first["reply"]["payload"]["text"]
    assert app.quest_service.history(older_quest["quest_id"]) == []
    assert app.list_connector_bindings("whatsapp") == []

    latest = app.create_quest(goal="whatsapp latest quest", source="web")
    latest_id = latest["quest_id"]

    bindings = app.list_connector_bindings("whatsapp")
    assert any(item["conversation_id"] == "whatsapp:direct:+15550001111" and item["quest_id"] == latest_id for item in bindings)

    second = app.handle_connector_inbound(
        "whatsapp",
        {
            "chat_type": "direct",
            "sender_id": "+15550001111",
            "sender_name": "Researcher",
            "text": "Please summarize the latest result.",
        },
    )
    assert second["accepted"] is True
    assert latest_id in second["reply"]["payload"]["text"]

    history = app.quest_service.history(latest_id)
    assert history
    assert history[-1]["content"] == "Please summarize the latest result."
    assert history[-1]["source"].startswith("whatsapp:")

    connector_statuses = {item["name"]: item for item in app.handlers.connectors()}
    assert "whatsapp" in connector_statuses
    assert "feishu" in connector_statuses
    assert connector_statuses["whatsapp"]["last_conversation_id"] == "whatsapp:direct:+15550001111"
    assert connector_statuses["whatsapp"]["transport"] == "local_session"
    assert connector_statuses["whatsapp"]["connection_state"] in {"configured", "ready"}
    assert connector_statuses["whatsapp"]["target_count"] >= 1
    assert any(
        item["conversation_id"] == "whatsapp:direct:+15550001111"
        for item in connector_statuses["whatsapp"]["discovered_targets"]
    )


def test_generic_connector_supports_terminal_command_and_restore(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    connectors = manager.load_named("connectors")
    connectors["whatsapp"]["enabled"] = True
    connectors["whatsapp"]["auto_bind_dm_to_active_quest"] = True
    write_yaml(manager.path_for("connectors"), connectors)

    quest = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home)).create("whatsapp terminal quest")
    quest_id = quest["quest_id"]
    app = DaemonApp(temp_home)
    conversation_id = "whatsapp:direct:+15550002222"
    channel = app._channel_with_bindings("whatsapp")
    channel.bind_conversation(conversation_id, quest_id)
    app.sessions.bind(quest_id, conversation_id)
    app.quest_service.bind_source(quest_id, conversation_id)

    command_reply = app.handle_connector_inbound(
        "whatsapp",
        {
            "chat_type": "direct",
            "sender_id": "+15550002222",
            "sender_name": "Researcher",
            "text": "/terminal pwd",
        },
    )
    assert command_reply["accepted"] is True
    assert "terminal-main" in command_reply["reply"]["payload"]["text"]

    restore_reply = app.handle_connector_inbound(
        "whatsapp",
        {
            "chat_type": "direct",
            "sender_id": "+15550002222",
            "sender_name": "Researcher",
            "text": "/terminal -R",
        },
    )
    assert restore_reply["accepted"] is True
    assert "Terminal `terminal-main`" in restore_reply["reply"]["payload"]["text"]
    assert "latest commands:" in restore_reply["reply"]["payload"]["text"]
