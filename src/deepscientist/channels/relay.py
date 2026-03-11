from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from ..connector_runtime import build_discovered_target, infer_connector_transport, merge_discovered_targets
from ..bridges import get_connector_bridge
from ..shared import append_jsonl, ensure_dir, generate_id, read_json, read_jsonl, utc_now, write_json
from .base import BaseChannel


class GenericRelayChannel(BaseChannel):
    display_mode = "user_facing_only"

    def __init__(self, home: Path, name: str, config: dict[str, Any] | None = None) -> None:
        super().__init__(home)
        self.name = name
        self.config = config or {}
        self.root = ensure_dir(home / "logs" / "connectors" / name)
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
                "transport": f"{self.name}-bridge",
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
        runtime_state = read_json(self.root / "runtime.json", {})
        last_conversation_id = str((state or {}).get("last_conversation_id") or "").strip() or None
        transport = infer_connector_transport(self.name, self.config)
        default_conversation_id = last_conversation_id or (bindings[0]["conversation_id"] if bindings else None)
        discovered_targets = merge_discovered_targets(
            [
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
        connection_state = self._connection_state(transport, last_conversation_id)
        auth_state = self._auth_state(transport)
        if (
            bool(self.config.get("enabled", False))
            and isinstance(runtime_state, dict)
            and str(runtime_state.get("transport") or "").strip() == transport
        ):
            runtime_connection_state = str(runtime_state.get("connection_state") or "").strip()
            runtime_auth_state = str(runtime_state.get("auth_state") or "").strip()
            if runtime_connection_state:
                connection_state = runtime_connection_state
            elif runtime_state.get("connected") is True:
                connection_state = "connected"
            elif runtime_state.get("last_error"):
                connection_state = "error"
            if runtime_auth_state:
                auth_state = runtime_auth_state
            elif runtime_state.get("auth_ok") is True:
                auth_state = "ready"
            elif runtime_state.get("auth_ok") is False:
                auth_state = "error"
        return {
            "name": self.name,
            "display_mode": self.display_mode,
            "mode": self.config.get("mode", "relay"),
            "transport": transport,
            "relay_url": self.config.get("relay_url"),
            "enabled": bool(self.config.get("enabled", False)),
            "connection_state": connection_state,
            "auth_state": auth_state,
            "last_conversation_id": last_conversation_id,
            "last_error": runtime_state.get("last_error") if isinstance(runtime_state, dict) else None,
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
        text = str(payload.get("text") or payload.get("message") or payload.get("content") or "").strip()
        sender_id = str(payload.get("sender_id") or payload.get("from") or payload.get("user_id") or "").strip()
        sender_name = str(payload.get("sender_name") or payload.get("from_name") or payload.get("username") or sender_id).strip()
        group_id = str(payload.get("group_id") or payload.get("channel_id") or payload.get("room_id") or "").strip()
        direct_id = str(payload.get("direct_id") or payload.get("chat_id") or payload.get("peer_id") or sender_id).strip()
        chat_type = str(payload.get("chat_type") or ("group" if group_id else "direct")).strip().lower()
        if chat_type not in {"group", "direct"}:
            chat_type = "group" if group_id else "direct"
        chat_key = group_id if chat_type == "group" else direct_id
        conversation_id = str(payload.get("conversation_id") or f"{self.name}:{chat_type}:{chat_key or 'unknown'}")
        message_id = str(payload.get("message_id") or payload.get("event_id") or generate_id(self.name))
        mentioned = bool(payload.get("mentioned")) or self._looks_like_mention(text)
        normalized_text = self._strip_mention_prefix(text)
        is_command = normalized_text.startswith(self.command_prefix())

        group_access = self._check_group_access(group_id=group_id, sender_id=sender_id)
        if chat_type == "group" and group_access is not None:
            return {
                "accepted": False,
                "reason": group_access,
                "conversation_id": conversation_id,
                "chat_type": chat_type,
                "message_id": message_id,
                "text": text,
                "sender_id": sender_id,
                "sender_name": sender_name,
                "group_id": group_id,
            }

        dm_access = self._check_dm_access(sender_id=sender_id)
        if chat_type == "direct" and dm_access is not None:
            return {
                "accepted": False,
                "reason": dm_access,
                "conversation_id": conversation_id,
                "chat_type": chat_type,
                "message_id": message_id,
                "text": text,
                "sender_id": sender_id,
                "sender_name": sender_name,
            }

        if chat_type == "group" and self.config.get("require_mention_in_groups", True) and not (mentioned or is_command):
            return {
                "accepted": False,
                "reason": "group_message_requires_mention",
                "conversation_id": conversation_id,
                "chat_type": chat_type,
                "message_id": message_id,
                "text": text,
                "sender_id": sender_id,
                "sender_name": sender_name,
            }

        return {
            "accepted": True,
            "channel": self.name,
            "conversation_id": conversation_id,
            "chat_type": chat_type,
            "message_id": message_id,
            "text": normalized_text,
            "raw_text": text,
            "sender_id": sender_id,
            "sender_name": sender_name,
            "group_id": group_id or None,
            "direct_id": direct_id or None,
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
        return f"@{bot_name}" in lowered

    def _strip_mention_prefix(self, text: str) -> str:
        cleaned = str(text or "").strip()
        bot_name = str(self.config.get("bot_name") or "DeepScientist").strip()
        prefix = f"@{bot_name}"
        if cleaned.startswith(prefix):
            return cleaned[len(prefix):].strip()
        return cleaned

    def _format_outbound(self, payload: dict[str, Any]) -> dict[str, Any]:
        text = str(payload.get("message") or "").strip()
        kind = str(payload.get("kind") or "message").strip()
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

    def _check_dm_access(self, *, sender_id: str) -> str | None:
        policy = str(self.config.get("dm_policy") or "pairing").strip().lower()
        allow_from = self._list_values(self.config.get("allow_from"))
        if policy == "disabled":
            return "direct_messages_disabled"
        if policy == "allowlist" and not self._matches_allowlist(sender_id, allow_from):
            return "direct_sender_not_allowlisted"
        if policy == "open":
            return None
        if policy == "pairing":
            return None
        return None

    def _check_group_access(self, *, group_id: str, sender_id: str) -> str | None:
        groups = self._list_values(self.config.get("groups"))
        if groups and "*" not in groups and (not group_id or group_id not in groups):
            return "group_not_allowlisted"
        policy = str(self.config.get("group_policy") or "open").strip().lower()
        group_allow_from = self._list_values(self.config.get("group_allow_from"))
        allow_from = self._list_values(self.config.get("allow_from"))
        effective_allow_from = group_allow_from or allow_from
        if policy == "disabled":
            return "group_messages_disabled"
        if policy == "allowlist" and not self._matches_allowlist(sender_id, effective_allow_from):
            return "group_sender_not_allowlisted"
        return None

    @staticmethod
    def _list_values(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        items: list[str] = []
        for item in value:
            normalized = str(item or "").strip()
            if normalized:
                items.append(normalized)
        return items

    @staticmethod
    def _matches_allowlist(sender_id: str, allow_from: list[str]) -> bool:
        normalized_sender = str(sender_id or "").strip()
        if not normalized_sender:
            return False
        if "*" in allow_from:
            return True
        return normalized_sender in allow_from

    def _deliver(self, record: dict[str, Any]) -> dict[str, Any] | None:
        bridge = get_connector_bridge(self.name)
        if bridge is not None:
            delivery = bridge.deliver(record, self.config)
            if delivery is not None:
                return delivery
        relay_url = str(self.config.get("relay_url") or "").strip()
        if not relay_url or self.config.get("mode", "relay") != "relay":
            return None
        body = json.dumps(record, ensure_ascii=False).encode("utf-8")
        request = Request(relay_url, data=body, method="POST")
        request.add_header("Content-Type", "application/json; charset=utf-8")
        token = str(self.config.get("relay_auth_token") or "").strip()
        if token:
            request.add_header("Authorization", f"Bearer {token}")
        try:
            with urlopen(request, timeout=5) as response:  # noqa: S310
                response_text = response.read().decode("utf-8", errors="replace")
                return {
                    "ok": 200 <= response.status < 300,
                    "status_code": response.status,
                    "response": response_text[:500],
                }
        except URLError as exc:
            return {
                "ok": False,
                "status_code": None,
                "error": str(exc),
            }

    def _connection_state(self, transport: str, last_conversation_id: str | None) -> str:
        if not bool(self.config.get("enabled", False)):
            return "disabled"
        if transport == "relay":
            return "relay_configured" if str(self.config.get("relay_url") or "").strip() else "awaiting_relay"
        if self._has_runtime_credentials(transport):
            return "ready" if last_conversation_id else "configured"
        return "needs_credentials"

    def _auth_state(self, transport: str) -> str:
        if not bool(self.config.get("enabled", False)):
            return "disabled"
        if transport == "relay":
            return "ready" if str(self.config.get("relay_url") or "").strip() else "missing_configuration"
        return "ready" if self._has_runtime_credentials(transport) else "missing_credentials"

    def _has_runtime_credentials(self, transport: str) -> bool:
        if self.name == "telegram":
            return bool(self._secret("bot_token", "bot_token_env"))
        if self.name == "discord":
            return bool(self._secret("bot_token", "bot_token_env"))
        if self.name == "slack":
            if transport == "socket_mode":
                return bool(self._secret("bot_token", "bot_token_env") and self._secret("app_token", "app_token_env"))
            return bool(self._secret("bot_token", "bot_token_env"))
        if self.name == "feishu":
            return bool(str(self.config.get("app_id") or "").strip() and self._secret("app_secret", "app_secret_env"))
        if self.name == "whatsapp":
            if transport == "local_session":
                return bool(str(self.config.get("session_dir") or "").strip())
            return bool(self._secret("access_token", "access_token_env") and str(self.config.get("phone_number_id") or "").strip())
        return False

    def _secret(self, key: str, env_key: str) -> str:
        direct = str(self.config.get(key) or "").strip()
        if direct:
            return direct
        env_name = str(self.config.get(env_key) or "").strip()
        if not env_name:
            return ""
        return str(os.environ.get(env_name) or "").strip()
