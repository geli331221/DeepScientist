from __future__ import annotations
import os
from pathlib import Path
from typing import Any

from ..connector_runtime import build_discovered_target, merge_discovered_targets
from ..bridges import get_connector_bridge
from ..shared import append_jsonl, ensure_dir, generate_id, read_json, read_jsonl, utc_now, write_json
from .base import BaseChannel


class QQRelayChannel(BaseChannel):
    name = "qq"
    display_mode = "user_facing_only"

    def __init__(self, home: Path, config: dict[str, Any] | None = None) -> None:
        super().__init__(home)
        self.config = config or {}
        self.root = ensure_dir(home / "logs" / "connectors" / "qq")
        self.inbox_path = self.root / "inbox.jsonl"
        self.outbox_path = self.root / "outbox.jsonl"
        self.ignored_path = self.root / "ignored.jsonl"
        self.bindings_path = self.root / "bindings.json"
        self.state_path = self.root / "state.json"

    def send(self, payload: dict[str, Any]) -> dict[str, Any]:
        formatted = self._format_outbound(payload)
        record = {"sent_at": utc_now(), **formatted}
        append_jsonl(self.outbox_path, record)
        try:
            delivery = self._deliver(record)
        except Exception as exc:  # pragma: no cover - defensive transport guard
            delivery = {
                "ok": False,
                "error": str(exc),
                "transport": "qq-http",
            }
        if delivery is not None:
            record["delivery"] = delivery
        return {
            "ok": delivery is None or delivery.get("ok", False),
            "queued": True,
            "channel": self.name,
            "payload": record,
            "delivery": delivery,
        }

    def poll(self) -> list[dict[str, Any]]:
        return read_jsonl(self.inbox_path)

    def status(self) -> dict[str, Any]:
        bindings = self.list_bindings()
        state = read_json(self.state_path, {})
        gateway_state = read_json(self.root / "gateway.json", {})
        last_conversation_id = str((state or {}).get("last_conversation_id") or "").strip() or None
        main_chat_id = str(self.config.get("main_chat_id") or "").strip() or None
        default_conversation_id = (
            f"qq:direct:{main_chat_id}"
            if main_chat_id
            else (last_conversation_id or (bindings[0]["conversation_id"] if bindings else None))
        )
        discovered_targets = merge_discovered_targets(
            [
                build_discovered_target(
                    default_conversation_id if main_chat_id else None,
                    source="saved_main_chat",
                    is_default=bool(main_chat_id),
                ),
                build_discovered_target(
                    last_conversation_id,
                    source="recent_runtime_activity",
                    is_default=last_conversation_id == default_conversation_id,
                    updated_at=str((state or {}).get("updated_at") or "").strip() or None,
                ),
                *[
                    build_discovered_target(
                        item.get("conversation_id"),
                        source="quest_binding",
                        is_default=item.get("conversation_id") == default_conversation_id,
                        quest_id=str(item.get("quest_id") or "").strip() or None,
                        updated_at=str(item.get("updated_at") or "").strip() or None,
                    )
                    for item in bindings
                ],
            ]
        )
        default_target = next((item for item in discovered_targets if item.get("is_default")), None)
        connection_state = self._connection_state(main_chat_id=main_chat_id, last_conversation_id=last_conversation_id)
        auth_state = self._auth_state()
        if bool(self.config.get("enabled", False)) and isinstance(gateway_state, dict):
            if gateway_state.get("connected") is True:
                connection_state = "connected"
            elif gateway_state.get("last_error"):
                connection_state = "error"
            elif gateway_state.get("enabled") and connection_state not in {"disabled", "needs_credentials"}:
                connection_state = "connecting"
            if gateway_state.get("last_error") and auth_state == "ready":
                auth_state = "ready"
        return {
            "name": self.name,
            "display_mode": self.display_mode,
            "mode": "gateway-direct",
            "transport": "gateway_direct",
            "relay_url": None,
            "enabled": bool(self.config.get("enabled", False)),
            "connection_state": connection_state,
            "auth_state": auth_state,
            "main_chat_id": main_chat_id,
            "last_conversation_id": last_conversation_id,
            "last_error": gateway_state.get("last_error") if isinstance(gateway_state, dict) else None,
            "inbox_count": len(read_jsonl(self.inbox_path)),
            "outbox_count": len(read_jsonl(self.outbox_path)),
            "ignored_count": len(read_jsonl(self.ignored_path)),
            "binding_count": len(bindings),
            "bindings": bindings,
            "target_count": len(discovered_targets),
            "default_target": default_target,
            "discovered_targets": discovered_targets,
        }

    def ingest(self, payload: dict[str, Any]) -> dict[str, Any]:
        normalized = self.normalize_inbound(payload)
        if not normalized.get("accepted", False):
            append_jsonl(self.ignored_path, {"received_at": utc_now(), **normalized})
            return {"ok": True, "accepted": False, "normalized": normalized}
        append_jsonl(self.inbox_path, {"received_at": utc_now(), **normalized})
        state = read_json(self.state_path, {})
        state["last_message_id"] = normalized.get("message_id")
        state["last_conversation_id"] = normalized.get("conversation_id")
        state["updated_at"] = utc_now()
        write_json(self.state_path, state)
        return {"ok": True, "accepted": True, "normalized": normalized}

    def normalize_inbound(self, payload: dict[str, Any]) -> dict[str, Any]:
        data = payload.get("d") if isinstance(payload.get("d"), dict) else payload
        text = str(
            payload.get("text")
            or data.get("text")
            or payload.get("content")
            or data.get("content")
            or ""
        ).strip()

        sender = payload.get("sender") if isinstance(payload.get("sender"), dict) else data.get("sender")
        author = data.get("author") if isinstance(data.get("author"), dict) else {}
        sender = sender or author or {}
        sender_id = str(
            payload.get("sender_id")
            or data.get("sender_id")
            or sender.get("id")
            or sender.get("user_id")
            or ""
        ).strip()
        sender_name = str(
            payload.get("sender_name")
            or data.get("sender_name")
            or sender.get("username")
            or sender.get("nick")
            or ""
        ).strip()

        group_id = str(
            payload.get("group_id")
            or data.get("group_id")
            or data.get("group_openid")
            or payload.get("chat_id")
            or ""
        ).strip()
        direct_id = str(
            payload.get("direct_id")
            or payload.get("dm_id")
            or data.get("direct_id")
            or data.get("openid")
            or sender_id
            or ""
        ).strip()
        chat_type = str(payload.get("chat_type") or data.get("chat_type") or ("group" if group_id else "direct")).strip().lower()
        if chat_type not in {"group", "direct"}:
            chat_type = "group" if group_id else "direct"
        chat_key = group_id if chat_type == "group" else direct_id
        conversation_id = str(payload.get("conversation_id") or data.get("conversation_id") or f"qq:{chat_type}:{chat_key or 'unknown'}")
        message_id = str(payload.get("message_id") or data.get("message_id") or data.get("id") or generate_id("qqmsg"))

        mentioned = bool(
            payload.get("mentioned")
            or payload.get("at_bot")
            or data.get("mentioned")
            or self._looks_like_mention(text)
        )
        normalized_text = self._strip_mention_prefix(text)
        is_command = normalized_text.startswith(self.command_prefix())

        if chat_type == "group" and self.config.get("require_at_in_groups", True) and not (mentioned or is_command):
            return {
                "accepted": False,
                "reason": "group_requires_mention_or_prefix",
                "conversation_id": conversation_id,
                "chat_type": chat_type,
                "message_id": message_id,
                "text": text,
                "sender_id": sender_id,
                "sender_name": sender_name,
            }

        return {
            "accepted": True,
            "message_id": message_id,
            "conversation_id": conversation_id,
            "chat_type": chat_type,
            "chat_id": chat_key,
            "text": normalized_text,
            "raw_text": text,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "mentioned": mentioned,
            "is_command": is_command,
            "created_at": utc_now(),
            "raw_event": payload,
        }

    def bind_conversation(self, conversation_id: str, quest_id: str) -> dict[str, Any]:
        bindings = read_json(self.bindings_path, {"bindings": {}})
        binding_map = dict(bindings.get("bindings") or {})
        binding_map[conversation_id] = {
            "quest_id": quest_id,
            "updated_at": utc_now(),
        }
        bindings["bindings"] = binding_map
        write_json(self.bindings_path, bindings)
        return binding_map[conversation_id]

    def resolve_bound_quest(self, conversation_id: str) -> str | None:
        bindings = read_json(self.bindings_path, {"bindings": {}})
        item = (bindings.get("bindings") or {}).get(conversation_id)
        if not isinstance(item, dict):
            return None
        quest_id = item.get("quest_id")
        return str(quest_id) if quest_id else None

    def list_bindings(self) -> list[dict[str, Any]]:
        bindings = read_json(self.bindings_path, {"bindings": {}})
        items: list[dict[str, Any]] = []
        for conversation_id, payload in sorted((bindings.get("bindings") or {}).items()):
            if not isinstance(payload, dict):
                continue
            items.append({"conversation_id": conversation_id, **payload})
        return items

    def command_prefix(self) -> str:
        return str(self.config.get("command_prefix") or "/").strip() or "/"

    def _looks_like_mention(self, text: str) -> bool:
        lowered = (text or "").lower()
        bot_name = str(self.config.get("bot_name") or "DeepScientist").strip().lower()
        app_id = str(self.config.get("app_id") or "").strip()
        candidates = [f"@{bot_name.lower()}"]
        if app_id:
            candidates.extend([f"<@!{app_id}>", f"<@{app_id}>"])
        return any(candidate in lowered for candidate in candidates)

    def _strip_mention_prefix(self, text: str) -> str:
        cleaned = str(text or "").strip()
        bot_name = str(self.config.get("bot_name") or "DeepScientist").strip()
        app_id = str(self.config.get("app_id") or "").strip()
        prefixes = [f"@{bot_name}"]
        if app_id:
            prefixes.extend([f"<@!{app_id}>", f"<@{app_id}>"])
        for prefix in prefixes:
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):].strip()
        return cleaned

    def _format_outbound(self, payload: dict[str, Any]) -> dict[str, Any]:
        text = str(payload.get("message") or "").strip()
        kind = str(payload.get("kind") or "message").strip()
        verdict = payload.get("verdict")
        action = payload.get("action")
        reason = payload.get("reason")
        if not text and kind in {"decision", "decision_request"}:
            fragments = []
            if verdict:
                fragments.append(f"Verdict: {verdict}")
            if action:
                fragments.append(f"Action: {action}")
            if reason:
                fragments.append(f"Reason: {reason}")
            text = "\n".join(fragments)
        attachments = self._normalize_attachments(payload.get("attachments"))
        return {
            "conversation_id": payload.get("conversation_id"),
            "reply_to_message_id": payload.get("reply_to_message_id"),
            "kind": kind,
            "text": text,
            "attachments": attachments,
            "quest_id": payload.get("quest_id"),
            "quest_root": payload.get("quest_root"),
            "importance": payload.get("importance"),
            "response_phase": payload.get("response_phase"),
        }

    @staticmethod
    def _normalize_attachments(value: Any) -> list[dict[str, Any]]:
        attachments: list[dict[str, Any]] = []
        if not isinstance(value, list):
            return attachments
        for item in value:
            if isinstance(item, str):
                attachments.append({"kind": "path", "path": item})
            elif isinstance(item, dict):
                attachments.append(dict(item))
        return attachments

    def _deliver(self, record: dict[str, Any]) -> dict[str, Any] | None:
        bridge = get_connector_bridge(self.name)
        if bridge is not None:
            return bridge.deliver(record, self.config)
        return None

    def _connection_state(self, *, main_chat_id: str | None, last_conversation_id: str | None) -> str:
        if not bool(self.config.get("enabled", False)):
            return "disabled"
        if not str(self.config.get("app_id") or "").strip() or not self._secret("app_secret", "app_secret_env"):
            return "needs_credentials"
        if main_chat_id or last_conversation_id:
            return "ready"
        return "awaiting_first_message"

    def _auth_state(self) -> str:
        if not bool(self.config.get("enabled", False)):
            return "disabled"
        if str(self.config.get("app_id") or "").strip() and self._secret("app_secret", "app_secret_env"):
            return "ready"
        return "missing_credentials"

    def _secret(self, key: str, env_key: str) -> str:
        direct = str(self.config.get(key) or "").strip()
        if direct:
            return direct
        env_name = str(self.config.get(env_key) or "").strip()
        if not env_name:
            return ""
        return str(os.environ.get(env_name) or "").strip()
