from __future__ import annotations

import json
import secrets
from typing import Any
from urllib.parse import urlparse


DEFAULT_LINGZHU_GATEWAY_PORT = 18789
DEFAULT_LINGZHU_LOCAL_HOST = "127.0.0.1"
DEFAULT_LINGZHU_AGENT_ID = "main"
DEFAULT_LINGZHU_SESSION_NAMESPACE = "lingzhu"

_AUTH_AK_SEGMENTS = (8, 4, 4, 4, 12)
_AUTH_AK_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"


def generate_lingzhu_auth_ak() -> str:
    parts: list[str] = []
    for segment_length in _AUTH_AK_SEGMENTS:
        parts.append("".join(secrets.choice(_AUTH_AK_CHARS) for _ in range(segment_length)))
    return "-".join(parts)


def lingzhu_local_host(config: dict[str, Any] | None) -> str:
    value = str((config or {}).get("local_host") or DEFAULT_LINGZHU_LOCAL_HOST).strip()
    return value or DEFAULT_LINGZHU_LOCAL_HOST


def lingzhu_gateway_port(config: dict[str, Any] | None) -> int:
    raw = (config or {}).get("gateway_port")
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_LINGZHU_GATEWAY_PORT
    if value < 1 or value > 65535:
        return DEFAULT_LINGZHU_GATEWAY_PORT
    return value


def normalize_public_base_url(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return text.rstrip("/")


def lingzhu_local_base_url(config: dict[str, Any] | None) -> str:
    return f"http://{lingzhu_local_host(config)}:{lingzhu_gateway_port(config)}"


def lingzhu_public_base_url(config: dict[str, Any] | None) -> str | None:
    return normalize_public_base_url((config or {}).get("public_base_url"))


def lingzhu_health_url(config: dict[str, Any] | None, *, public: bool = False) -> str | None:
    base = lingzhu_public_base_url(config) if public else lingzhu_local_base_url(config)
    if not base:
        return None
    return f"{base}/metis/agent/api/health"


def lingzhu_sse_url(config: dict[str, Any] | None, *, public: bool = False) -> str | None:
    base = lingzhu_public_base_url(config) if public else lingzhu_local_base_url(config)
    if not base:
        return None
    return f"{base}/metis/agent/api/sse"


def lingzhu_agent_id(config: dict[str, Any] | None) -> str:
    value = str((config or {}).get("agent_id") or DEFAULT_LINGZHU_AGENT_ID).strip()
    return value or DEFAULT_LINGZHU_AGENT_ID


def lingzhu_probe_payload(
    config: dict[str, Any] | None,
    *,
    message_id: str = "ds-lingzhu-probe-001",
    text: str = "你好",
) -> dict[str, Any]:
    return {
        "message_id": message_id,
        "agent_id": lingzhu_agent_id(config),
        "message": [
            {
                "role": "user",
                "type": "text",
                "text": text,
            }
        ],
    }


def lingzhu_generated_openclaw_config(config: dict[str, Any] | None) -> dict[str, Any]:
    resolved = dict(config or {})
    return {
        "gateway": {
            "port": lingzhu_gateway_port(resolved),
            "http": {
                "endpoints": {
                    "chatCompletions": {
                        "enabled": True,
                    }
                }
            },
        },
        "plugins": {
            "entries": {
                "lingzhu": {
                    "enabled": bool(resolved.get("enabled", False)),
                    "config": {
                        "authAk": str(resolved.get("auth_ak") or "").strip(),
                        "agentId": lingzhu_agent_id(resolved),
                        "includeMetadata": bool(resolved.get("include_metadata", True)),
                        "requestTimeoutMs": int(resolved.get("request_timeout_ms") or 60000),
                        "systemPrompt": str(resolved.get("system_prompt") or ""),
                        "defaultNavigationMode": str(resolved.get("default_navigation_mode") or "0"),
                        "enableFollowUp": bool(resolved.get("enable_follow_up", True)),
                        "followUpMaxCount": int(resolved.get("follow_up_max_count") or 3),
                        "maxImageBytes": int(resolved.get("max_image_bytes") or 5 * 1024 * 1024),
                        "sessionMode": str(resolved.get("session_mode") or "per_user"),
                        "sessionNamespace": str(
                            resolved.get("session_namespace") or DEFAULT_LINGZHU_SESSION_NAMESPACE
                        ),
                        "autoReceiptAck": bool(resolved.get("auto_receipt_ack", True)),
                        "visibleProgressHeartbeat": bool(
                            resolved.get("visible_progress_heartbeat", True)
                        ),
                        "visibleProgressHeartbeatSec": int(
                            resolved.get("visible_progress_heartbeat_sec") or 10
                        ),
                        "debugLogging": bool(resolved.get("debug_logging", False)),
                        "debugLogPayloads": bool(resolved.get("debug_log_payloads", False)),
                        "debugLogDir": str(resolved.get("debug_log_dir") or ""),
                        "enableExperimentalNativeActions": bool(
                            resolved.get("enable_experimental_native_actions", False)
                        ),
                    },
                }
            }
        },
    }


def lingzhu_generated_openclaw_config_text(config: dict[str, Any] | None) -> str:
    return json.dumps(lingzhu_generated_openclaw_config(config), indent=2, ensure_ascii=False)


def lingzhu_generated_curl(config: dict[str, Any] | None, *, text: str = "你好") -> str:
    auth_ak = str((config or {}).get("auth_ak") or "").strip()
    payload = lingzhu_probe_payload(config, text=text)
    endpoint_url = lingzhu_sse_url(config) or ""
    return (
        f"curl -X POST '{endpoint_url}' \\\n"
        f"  --header 'Authorization: Bearer {auth_ak}' \\\n"
        "  --header 'Content-Type: application/json' \\\n"
        f"  --data '{json.dumps(payload, ensure_ascii=False)}'"
    )


def lingzhu_supported_commands(*, experimental_enabled: bool) -> list[str]:
    commands = [
        "take_photo",
        "take_navigation",
        "control_calendar",
        "notify_agent_off",
    ]
    if experimental_enabled:
        commands.extend(
            [
                "send_notification",
                "send_toast",
                "speak_tts",
                "start_video_record",
                "stop_video_record",
                "open_custom_view",
            ]
        )
    return commands
