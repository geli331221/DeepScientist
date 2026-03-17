from __future__ import annotations

from pathlib import Path

from deepscientist.config import ConfigManager
from deepscientist.daemon.app import DaemonApp
from deepscientist.home import ensure_home_layout, repo_root
from deepscientist.quest import QuestService
from deepscientist.shared import read_json
from deepscientist.skills import SkillInstaller


class _FakeResponse:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload
        self._offset = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self, size: int = -1) -> bytes:
        if size is None or size < 0:
            size = len(self._payload) - self._offset
        chunk = self._payload[self._offset : self._offset + size]
        self._offset += len(chunk)
        return chunk


def test_connector_inbound_attachment_is_downloaded_to_userfiles_and_injected_into_message(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    ConfigManager(temp_home).ensure_files()
    quest = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home)).create(
        "connector attachment quest"
    )
    quest_id = str(quest["quest_id"])
    app = DaemonApp(temp_home)
    conversation_id = "qq:direct:openid-attachment"
    app.channels["qq"].bind_conversation(conversation_id, quest_id)

    monkeypatch.setattr(
        app,
        "schedule_turn",
        lambda *args, **kwargs: {"scheduled": False, "started": False, "queued": False, "reason": "test"},
    )
    monkeypatch.setattr(
        "deepscientist.daemon.app.urlopen",
        lambda request, timeout=20: _FakeResponse(b"fake-image-bytes"),
    )

    app._route_connector_message(
        "qq",
        {
            "conversation_id": conversation_id,
            "chat_type": "direct",
            "sender_id": "openid-attachment",
            "sender_name": "qq-user",
            "message_id": "msg-attachment-001",
            "text": "请看这个图片",
            "attachments": [
                {
                    "name": "figure.png",
                    "content_type": "image/png",
                    "url": "https://example.test/figure.png",
                    "attachment_id": "att-001",
                }
            ],
        },
    )

    history = app.quest_service.history(quest_id, limit=10)
    latest_user = next(item for item in reversed(history) if item.get("role") == "user")
    attachment = dict((latest_user.get("attachments") or [])[0])
    local_path = Path(str(attachment.get("path") or ""))

    assert local_path.exists()
    assert local_path.read_bytes() == b"fake-image-bytes"
    assert "用户刚刚发送了附件" in str(latest_user.get("content") or "")
    assert str(local_path) in str(latest_user.get("content") or "")

    manifest = read_json(local_path.parent / "manifest.json", {})
    assert manifest.get("quest_id") == quest_id
    assert len(manifest.get("attachments") or []) == 1
    assert str((manifest.get("attachments") or [])[0].get("path") or "") == str(local_path)
