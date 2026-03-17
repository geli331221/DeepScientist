from __future__ import annotations
import os
from pathlib import Path
from typing import Any

from ..connector_runtime import build_discovered_target, conversation_identity_key, merge_discovered_targets, parse_conversation_id
from ..bridges import get_connector_bridge
from ..shared import append_jsonl, ensure_dir, generate_id, read_json, read_jsonl, utc_now, write_json
from .base import BaseChannel


class QQRelayChannel(BaseChannel):
    name = "qq"
    display_mode = "user_facing_only"
    recent_conversation_limit = 20
    recent_event_limit = 12

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
        try:
            delivery = self._deliver(record)
        except Exception as exc:  # pragma: no cover - defensive transport guard
            delivery = {
                "ok": False,
                "queued": False,
                "error": str(exc),
                "transport": "qq-http",
            }
        if not isinstance(delivery, dict):
            delivery = {
                "ok": False,
                "queued": False,
                "error": "QQ outbound delivery has no active transport.",
                "transport": "qq-http",
            }
        else:
            delivery = {
                **delivery,
                "ok": bool(delivery.get("ok", False)),
                "queued": bool(delivery.get("queued", False)),
                "transport": str(delivery.get("transport") or "qq-http"),
            }
        record["delivery"] = delivery
        append_jsonl(self.outbox_path, record)
        self._remember_conversation(
            conversation_id=record.get("conversation_id"),
            updated_at=str(record.get("sent_at") or utc_now()),
            source="outbound_delivery",
            quest_id=str(record.get("quest_id") or "").strip() or None,
        )
        return {
            "ok": bool(delivery.get("ok", False)),
            "queued": bool(delivery.get("queued", False)),
            "channel": self.name,
            "payload": record,
            "delivery": delivery,
        }

    def poll(self) -> list[dict[str, Any]]:
        return read_jsonl(self.inbox_path)

    def status(self) -> dict[str, Any]:
        bindings = self.list_bindings()
        state = self._read_state()
        gateway_state = read_json(self.root / "gateway.json", {})
        gateway_last_conversation_id = (
            str((gateway_state or {}).get("last_conversation_id") or "").strip() or None
            if isinstance(gateway_state, dict)
            else None
        )
        last_conversation_id = str((state or {}).get("last_conversation_id") or gateway_last_conversation_id or "").strip() or None
        main_chat_id = str(self.config.get("main_chat_id") or "").strip() or None
        default_conversation_id = (
            f"qq:direct:{main_chat_id}"
            if main_chat_id
            else (last_conversation_id or (bindings[0]["conversation_id"] if bindings else None))
        )
        recent_conversations = self._recent_conversations(state)
        discovered_targets = merge_discovered_targets(
            [
                build_discovered_target(
                    default_conversation_id if main_chat_id else None,
                    source="saved_main_chat",
                    is_default=bool(main_chat_id),
                ),
                *[
                    build_discovered_target(
                        item.get("conversation_id"),
                        source=str(item.get("source") or "recent_activity"),
                        is_default=item.get("conversation_id") == default_conversation_id,
                        label=str(item.get("label") or "").strip() or None,
                        quest_id=str(item.get("quest_id") or "").strip() or None,
                        updated_at=str(item.get("updated_at") or "").strip() or None,
                    )
                    for item in recent_conversations
                ],
                build_discovered_target(
                    gateway_last_conversation_id,
                    source="recent_runtime_activity",
                    is_default=gateway_last_conversation_id == default_conversation_id,
                    updated_at=str((gateway_state or {}).get("updated_at") or "").strip() or None,
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
            "recent_conversations": recent_conversations,
            "recent_events": self._recent_events(),
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
        self._remember_conversation(
            conversation_id=normalized.get("conversation_id"),
            updated_at=str(normalized.get("created_at") or utc_now()),
            source="recent_inbound",
            sender_id=str(normalized.get("sender_id") or "").strip() or None,
            sender_name=str(normalized.get("sender_name") or "").strip() or None,
            quest_id=str(normalized.get("quest_id") or "").strip() or None,
            message_id=str(normalized.get("message_id") or "").strip() or None,
        )
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
        attachments = self._normalize_inbound_attachments(payload.get("attachments") or data.get("attachments"))

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
            "attachments": attachments,
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
        self._remember_conversation(
            conversation_id=conversation_id,
            updated_at=str(binding_map[conversation_id].get("updated_at") or utc_now()),
            source="quest_binding",
            quest_id=quest_id,
        )
        return binding_map[conversation_id]

    def unbind_conversation(self, conversation_id: str, *, quest_id: str | None = None) -> bool:
        bindings = read_json(self.bindings_path, {"bindings": {}})
        binding_map = dict(bindings.get("bindings") or {})
        existing = binding_map.get(conversation_id)
        if quest_id and isinstance(existing, dict) and str(existing.get("quest_id") or "").strip() != quest_id:
            return False
        if conversation_id not in binding_map:
            return False
        binding_map.pop(conversation_id, None)
        bindings["bindings"] = binding_map
        write_json(self.bindings_path, bindings)
        return True

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
        conversation_id = str(payload.get("conversation_id") or "").strip()
        return {
            "conversation_id": conversation_id,
            "reply_to_message_id": payload.get("reply_to_message_id") or self._reply_to_message_id_for(conversation_id),
            "kind": kind,
            "text": text,
            "attachments": attachments,
            "surface_actions": [dict(item) for item in (payload.get("surface_actions") or []) if isinstance(item, dict)],
            "connector_hints": dict(payload.get("connector_hints")) if isinstance(payload.get("connector_hints"), dict) else {},
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

    @staticmethod
    def _normalize_inbound_attachments(value: Any) -> list[dict[str, Any]]:
        attachments: list[dict[str, Any]] = []
        if not isinstance(value, list):
            return attachments
        for item in value:
            if not isinstance(item, dict):
                continue
            normalized = {
                "kind": str(item.get("kind") or item.get("content_type") or "remote").strip() or "remote",
                "name": str(item.get("filename") or item.get("file_name") or item.get("name") or "").strip() or None,
                "content_type": str(item.get("content_type") or item.get("mime_type") or "").strip() or None,
                "url": str(item.get("url") or item.get("download_url") or "").strip() or None,
                "size_bytes": item.get("size") if isinstance(item.get("size"), int) else item.get("size_bytes"),
                "attachment_id": str(item.get("id") or item.get("attachment_id") or "").strip() or None,
            }
            extras = {
                key: value
                for key, value in item.items()
                if key
                not in {
                    "kind",
                    "content_type",
                    "mime_type",
                    "filename",
                    "file_name",
                    "name",
                    "url",
                    "download_url",
                    "size",
                    "size_bytes",
                    "id",
                    "attachment_id",
                }
            }
            if extras:
                normalized["raw"] = extras
            attachments.append({key: value for key, value in normalized.items() if value is not None})
        return attachments

    def _deliver(self, record: dict[str, Any]) -> dict[str, Any] | None:
        bridge = get_connector_bridge(self.name)
        if bridge is not None:
            return bridge.deliver(record, self.config)
        return None

    def _read_state(self) -> dict[str, Any]:
        payload = read_json(self.state_path, {})
        return payload if isinstance(payload, dict) else {}

    def _write_state(self, payload: dict[str, Any]) -> None:
        write_json(self.state_path, payload)

    def _recent_conversations(self, state: dict[str, Any]) -> list[dict[str, Any]]:
        items = state.get("recent_conversations")
        if not isinstance(items, list):
            return []
        merged: dict[str, dict[str, Any]] = {}
        for raw in items:
            if not isinstance(raw, dict):
                continue
            conversation_id = str(raw.get("conversation_id") or "").strip()
            if not conversation_id:
                continue
            identity = conversation_identity_key(conversation_id)
            existing = merged.get(identity)
            current = dict(raw)
            if existing is None:
                merged[identity] = current
                continue
            if str(current.get("updated_at") or "") >= str(existing.get("updated_at") or ""):
                merged[identity] = {**existing, **current}
            else:
                merged[identity] = {**current, **existing}
        ordered = sorted(
            merged.values(),
            key=lambda item: (str(item.get("updated_at") or ""), str(item.get("conversation_id") or "")),
            reverse=True,
        )
        return ordered[: self.recent_conversation_limit]

    def _remember_conversation(
        self,
        *,
        conversation_id: Any,
        updated_at: str,
        source: str,
        sender_id: str | None = None,
        sender_name: str | None = None,
        quest_id: str | None = None,
        message_id: str | None = None,
    ) -> None:
        entry = self._build_recent_conversation_entry(
            conversation_id=conversation_id,
            updated_at=updated_at,
            source=source,
            sender_id=sender_id,
            sender_name=sender_name,
            quest_id=quest_id,
            message_id=message_id,
        )
        if entry is None:
            return
        state = self._read_state()
        state["last_conversation_id"] = entry["conversation_id"]
        if message_id:
            state["last_message_id"] = message_id
        state["updated_at"] = updated_at
        state["recent_conversations"] = self._recent_conversations(
            {
                "recent_conversations": [entry, *list(state.get("recent_conversations") or [])],
            }
        )
        self._write_state(state)

    def _build_recent_conversation_entry(
        self,
        *,
        conversation_id: Any,
        updated_at: str,
        source: str,
        sender_id: str | None = None,
        sender_name: str | None = None,
        quest_id: str | None = None,
        message_id: str | None = None,
    ) -> dict[str, Any] | None:
        parsed = parse_conversation_id(conversation_id)
        if parsed is None:
            return None
        payload: dict[str, Any] = {
            **parsed,
            "label": self._conversation_label(
                chat_type=parsed["chat_type"],
                chat_id=parsed["chat_id"],
                sender_name=sender_name,
            ),
            "updated_at": updated_at,
            "source": source,
        }
        if sender_id:
            payload["sender_id"] = sender_id
        if sender_name:
            payload["sender_name"] = sender_name
        if quest_id:
            payload["quest_id"] = quest_id
        if message_id:
            payload["message_id"] = message_id
        return payload

    @staticmethod
    def _conversation_label(*, chat_type: str, chat_id: str, sender_name: str | None = None) -> str:
        if sender_name and str(chat_type or "").strip().lower() == "direct":
            return f"{sender_name} · {chat_id}"
        return f"{chat_type} · {chat_id}"

    def _recent_events(self) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []
        for record in read_jsonl(self.inbox_path)[-self.recent_event_limit :]:
            event = self._build_recent_event("inbound", record)
            if event is not None:
                events.append(event)
        for record in read_jsonl(self.outbox_path)[-self.recent_event_limit :]:
            event = self._build_recent_event("outbound", record)
            if event is not None:
                events.append(event)
        for record in read_jsonl(self.ignored_path)[-self.recent_event_limit :]:
            event = self._build_recent_event("ignored", record)
            if event is not None:
                events.append(event)
        events.sort(key=lambda item: (str(item.get("created_at") or ""), str(item.get("conversation_id") or "")), reverse=True)
        return events[: self.recent_event_limit]

    def _reply_to_message_id_for(self, conversation_id: str) -> str | None:
        normalized = str(conversation_id or "").strip()
        if not normalized:
            return None
        identity = conversation_identity_key(normalized)
        state = self._read_state()
        for item in self._recent_conversations(state):
            if conversation_identity_key(str(item.get("conversation_id") or "").strip()) != identity:
                continue
            message_id = str(item.get("message_id") or "").strip()
            if message_id:
                return message_id
        return None

    def _build_recent_event(self, event_type: str, record: dict[str, Any]) -> dict[str, Any] | None:
        if not isinstance(record, dict):
            return None
        conversation_id = str(record.get("conversation_id") or "").strip()
        parsed = parse_conversation_id(conversation_id) if conversation_id else None
        delivery = record.get("delivery") if isinstance(record.get("delivery"), dict) else {}
        chat_type = str((parsed or {}).get("chat_type") or record.get("chat_type") or "direct")
        chat_id = str((parsed or {}).get("chat_id") or record.get("chat_id") or "unknown")
        return {
            "event_type": event_type,
            "created_at": str(record.get("received_at") or record.get("sent_at") or record.get("created_at") or record.get("updated_at") or utc_now()),
            "conversation_id": conversation_id or None,
            "chat_type": chat_type,
            "chat_id": chat_id,
            "label": self._conversation_label(
                chat_type=chat_type,
                chat_id=chat_id,
                sender_name=str(record.get("sender_name") or "").strip() or None,
            ),
            "kind": str(record.get("kind") or "").strip() or None,
            "message": self._event_preview(
                str(record.get("text") or record.get("message") or record.get("raw_text") or "").strip()
            )
            or None,
            "reason": str(record.get("reason") or "").strip() or None,
            "ok": bool(delivery.get("ok", False)) if event_type == "outbound" else None,
            "queued": bool(delivery.get("queued", False)) if event_type == "outbound" else None,
            "transport": str(delivery.get("transport") or "").strip() or None,
        }

    @staticmethod
    def _event_preview(text: str, *, limit: int = 140) -> str:
        normalized = " ".join(str(text or "").split())
        if len(normalized) <= limit:
            return normalized
        return f"{normalized[: max(limit - 1, 0)].rstrip()}…"

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
