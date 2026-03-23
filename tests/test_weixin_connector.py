from __future__ import annotations

import base64
import time
from pathlib import Path

import pytest

from deepscientist.channels.weixin_ilink import WeixinIlinkService
from deepscientist.home import ensure_home_layout
from deepscientist.shared import ensure_dir
from deepscientist.connector.weixin_support import (
    get_weixin_context_token,
    get_weixin_updates,
    load_weixin_get_updates_buf,
    send_weixin_message,
    upload_local_media_to_weixin,
)


def test_weixin_ilink_service_polls_updates_and_persists_context_token(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    events: list[dict] = []
    calls = {"count": 0}

    def fake_get_updates(*, base_url, token, get_updates_buf="", route_tag=None, timeout_ms=35_000):  # noqa: ANN001
        calls["count"] += 1
        if calls["count"] == 1:
            return {
                "ret": 0,
                "msgs": [
                    {
                        "from_user_id": "wx-user-1@im.wechat",
                        "message_id": 1001,
                        "context_token": "ctx-token-1",
                        "item_list": [
                            {
                                "type": 1,
                                "text_item": {"text": "hello from weixin"},
                            }
                        ],
                    }
                ],
                "get_updates_buf": "buf-1",
            }
        service.stop()
        return {"ret": 0, "msgs": [], "get_updates_buf": "buf-1"}

    monkeypatch.setattr("deepscientist.channels.weixin_ilink.get_weixin_updates", fake_get_updates)

    service = WeixinIlinkService(
        home=temp_home,
        config={
            "enabled": True,
            "transport": "ilink_long_poll",
            "bot_token": "wx-bot-token",
            "account_id": "wx-bot-1@im.bot",
            "base_url": "https://ilinkai.weixin.qq.com",
            "cdn_base_url": "https://novac2c.cdn.weixin.qq.com/c2c",
        },
        on_event=lambda event: events.append(event),
    )

    assert service.start() is True
    deadline = time.time() + 3.0
    while time.time() < deadline and not events:
        time.sleep(0.05)
    service.stop()

    assert events
    assert events[0]["conversation_id"] == "weixin:direct:wx-user-1@im.wechat"
    assert events[0]["text"] == "hello from weixin"
    connector_root = ensure_dir(temp_home / "logs" / "connectors" / "weixin")
    assert get_weixin_context_token(connector_root, "wx-user-1@im.wechat") == "ctx-token-1"
    assert load_weixin_get_updates_buf(connector_root) == "buf-1"


def test_weixin_ilink_service_emits_media_only_messages_as_attachments(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    events: list[dict] = []
    media_path = temp_home / "downloaded-weixin-image.png"
    media_path.write_bytes(b"fake-png")
    calls = {"count": 0}

    def fake_get_updates(*, base_url, token, get_updates_buf="", route_tag=None, timeout_ms=35_000):  # noqa: ANN001
        calls["count"] += 1
        if calls["count"] == 1:
            return {
                "ret": 0,
                "msgs": [
                    {
                        "from_user_id": "wx-user-2@im.wechat",
                        "message_id": 1002,
                        "context_token": "ctx-token-2",
                        "item_list": [
                            {
                                "type": 2,
                                "image_item": {
                                    "media": {
                                        "encrypt_query_param": "enc-param",
                                        "aes_key": "YWJjZGVmZ2hpamtsbW5vcA==",
                                    }
                                },
                            }
                        ],
                    }
                ],
                "get_updates_buf": "buf-2",
            }
        service.stop()
        return {"ret": 0, "msgs": [], "get_updates_buf": "buf-2"}

    monkeypatch.setattr("deepscientist.channels.weixin_ilink.get_weixin_updates", fake_get_updates)
    monkeypatch.setattr(
        "deepscientist.channels.weixin_ilink.download_weixin_message_attachment",
        lambda **kwargs: {
            "kind": "path",
            "name": "weixin-image.png",
            "content_type": "image/png",
            "path": str(media_path),
        },
    )

    service = WeixinIlinkService(
        home=temp_home,
        config={
            "enabled": True,
            "transport": "ilink_long_poll",
            "bot_token": "wx-bot-token",
            "account_id": "wx-bot-1@im.bot",
            "base_url": "https://ilinkai.weixin.qq.com",
            "cdn_base_url": "https://novac2c.cdn.weixin.qq.com/c2c",
        },
        on_event=lambda event: events.append(event),
    )

    assert service.start() is True
    deadline = time.time() + 3.0
    while time.time() < deadline and not events:
        time.sleep(0.05)
    service.stop()

    assert events
    assert events[0]["conversation_id"] == "weixin:direct:wx-user-2@im.wechat"
    assert events[0]["text"] == ""
    assert (events[0].get("attachments") or [])[0]["path"] == str(media_path)


def test_upload_local_media_to_weixin_encodes_aes_key_like_openclaw(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    payload_path = temp_home / "payload.bin"
    payload_path.write_bytes(b"hello-weixin")

    monkeypatch.setattr(
        "deepscientist.connector.weixin_support.get_weixin_upload_url",
        lambda **kwargs: {"upload_param": "upload-param-1"},
    )
    monkeypatch.setattr(
        "deepscientist.connector.weixin_support.upload_buffer_to_weixin_cdn",
        lambda **kwargs: {"download_param": "download-param-1", "ciphertext_size": 32},
    )

    random_values = iter([b"\x01" * 16, b"\x02" * 16])
    monkeypatch.setattr(
        "deepscientist.connector.weixin_support.os.urandom",
        lambda size: next(random_values),
    )

    uploaded = upload_local_media_to_weixin(
        file_path=payload_path,
        to_user_id="wx-user-3@im.wechat",
        base_url="https://ilinkai.weixin.qq.com",
        cdn_base_url="https://novac2c.cdn.weixin.qq.com/c2c",
        token="wx-token",
        media_type=1,
    )

    expected_hex = "02" * 16
    expected_b64 = base64.b64encode(expected_hex.encode("ascii")).decode("ascii")

    assert uploaded["aes_key_hex"] == expected_hex
    assert uploaded["aes_key_base64"] == expected_b64


def test_send_weixin_message_raises_on_nonzero_ret(monkeypatch) -> None:
    class _Response:
        def __init__(self, payload: str) -> None:
            self._payload = payload.encode("utf-8")

        def read(self) -> bytes:
            return self._payload

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(
        "deepscientist.connector.weixin_support.urlopen",
        lambda request, timeout=15: _Response('{"ret":-2,"errmsg":"context invalid"}'),
    )

    with pytest.raises(RuntimeError, match="ret=-2"):
        send_weixin_message(
            base_url="https://ilinkai.weixin.qq.com",
            token="wx-token",
            body={"msg": {"to_user_id": "wx-user-1@im.wechat", "item_list": [{"type": 1, "text_item": {"text": "hello"}}]}},
        )


def test_get_weixin_updates_treats_timeout_as_empty_poll(monkeypatch) -> None:
    def _raise_timeout(request, timeout=35):  # noqa: ANN001
        raise TimeoutError("timed out")

    monkeypatch.setattr("deepscientist.connector.weixin_support.urlopen", _raise_timeout)

    response = get_weixin_updates(
        base_url="https://ilinkai.weixin.qq.com",
        token="wx-token",
        get_updates_buf="buf-123",
        timeout_ms=5000,
    )

    assert response == {"ret": 0, "msgs": [], "get_updates_buf": "buf-123"}
