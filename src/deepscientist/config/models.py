from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


CONFIG_NAMES = ("config", "runners", "connectors", "plugins", "mcp_servers")
REQUIRED_CONFIG_NAMES = ("config", "runners", "connectors")
OPTIONAL_CONFIG_NAMES = ("plugins", "mcp_servers")


@dataclass(frozen=True)
class ConfigFileInfo:
    name: str
    path: Path
    required: bool
    exists: bool


def config_filename(name: str) -> str:
    return f"{name}.yaml"


def default_config(home: Path) -> dict:
    return {
        "home": str(home),
        "default_runner": "codex",
        "default_locale": "zh-CN",
        "daemon": {
            "session_restore_on_start": True,
            "max_concurrent_quests": 1,
            "ack_timeout_ms": 1000,
        },
        "ui": {
            "host": "0.0.0.0",
            "port": 20999,
            "auto_open_browser": True,
            "default_mode": "both",
        },
        "logging": {
            "level": "info",
            "console": True,
            "keep_days": 30,
        },
        "git": {
            "auto_checkpoint": True,
            "auto_push": False,
            "default_remote": "origin",
            "graph_formats": ["svg", "png", "json"],
        },
        "skills": {
            "sync_global_on_init": True,
            "sync_quest_on_create": True,
            "sync_quest_on_open": True,
        },
        "connectors": {
            "auto_ack": True,
            "milestone_push": True,
            "direct_chat_enabled": True,
        },
        "cloud": {
            "enabled": False,
            "base_url": "https://deepscientist.cc",
            "token": None,
            "token_env": "DEEPSCIENTIST_TOKEN",
            "verify_token_on_start": False,
            "sync_mode": "disabled",
        },
        "acp": {
            "compatibility_profile": "deepscientist-acp-compat/v1",
            "events_transport": "rest-poll",
            "sdk_bridge_enabled": False,
            "sdk_module": "acp",
        },
    }


def default_runners() -> dict:
    return {
        "codex": {
            "enabled": True,
            "binary": "codex",
            "config_dir": "~/.codex",
            "model": "gpt-5.4",
            "approval_policy": "on-request",
            "sandbox_mode": "workspace-write",
            "env": {},
        },
        "claude": {
            "enabled": False,
            "binary": "claude",
            "config_dir": "~/.claude",
            "model": "inherit",
            "env": {},
            "status": "reserved_todo",
        },
    }


def default_connectors() -> dict:
    return {
        "_routing": {
            "primary_connector": None,
            "artifact_delivery_policy": "primary_plus_local",
        },
        "qq": {
            "enabled": False,
            "transport": "gateway_direct",
            "app_id": None,
            "app_secret": None,
            "app_secret_env": "QQ_APP_SECRET",
            "bot_name": "DeepScientist",
            "command_prefix": "/",
            "main_chat_id": None,
            "require_at_in_groups": True,
            "auto_bind_dm_to_active_quest": False,
            "gateway_restart_on_config_change": True,
        },
        "telegram": {
            "enabled": False,
            "transport": "polling",
            "mode": "relay",
            "bot_name": "DeepScientist",
            "command_prefix": "/",
            "bot_token": None,
            "bot_token_env": "TELEGRAM_BOT_TOKEN",
            "webhook_secret": None,
            "webhook_secret_env": "TELEGRAM_WEBHOOK_SECRET",
            "public_callback_url": None,
            "relay_url": None,
            "relay_auth_token": None,
            "dm_policy": "pairing",
            "allow_from": [],
            "group_policy": "open",
            "group_allow_from": [],
            "groups": [],
            "require_mention_in_groups": True,
            "auto_bind_dm_to_active_quest": True,
        },
        "discord": {
            "enabled": False,
            "transport": "gateway",
            "mode": "relay",
            "bot_name": "DeepScientist",
            "command_prefix": "/",
            "bot_token": None,
            "bot_token_env": "DISCORD_BOT_TOKEN",
            "application_id": None,
            "public_key": None,
            "public_key_env": "DISCORD_PUBLIC_KEY",
            "public_interactions_url": None,
            "relay_url": None,
            "relay_auth_token": None,
            "dm_policy": "pairing",
            "allow_from": [],
            "group_policy": "open",
            "group_allow_from": [],
            "groups": [],
            "require_mention_in_groups": True,
            "auto_bind_dm_to_active_quest": True,
            "guild_allowlist": [],
        },
        "slack": {
            "enabled": False,
            "transport": "socket_mode",
            "mode": "relay",
            "bot_name": "DeepScientist",
            "command_prefix": "/",
            "bot_token": None,
            "bot_token_env": "SLACK_BOT_TOKEN",
            "bot_user_id": None,
            "app_token": None,
            "app_token_env": "SLACK_APP_TOKEN",
            "signing_secret": None,
            "signing_secret_env": "SLACK_SIGNING_SECRET",
            "public_callback_url": None,
            "relay_url": None,
            "relay_auth_token": None,
            "dm_policy": "pairing",
            "allow_from": [],
            "group_policy": "open",
            "group_allow_from": [],
            "groups": [],
            "require_mention_in_groups": True,
            "auto_bind_dm_to_active_quest": True,
        },
        "feishu": {
            "enabled": False,
            "transport": "long_connection",
            "mode": "relay",
            "bot_name": "DeepScientist",
            "command_prefix": "/",
            "app_id": None,
            "app_secret": None,
            "app_secret_env": "FEISHU_APP_SECRET",
            "verification_token": None,
            "verification_token_env": "FEISHU_VERIFICATION_TOKEN",
            "encrypt_key": None,
            "encrypt_key_env": "FEISHU_ENCRYPT_KEY",
            "api_base_url": "https://open.feishu.cn",
            "public_callback_url": None,
            "relay_url": None,
            "relay_auth_token": None,
            "dm_policy": "pairing",
            "allow_from": [],
            "group_policy": "open",
            "group_allow_from": [],
            "groups": [],
            "require_mention_in_groups": True,
            "auto_bind_dm_to_active_quest": True,
        },
        "whatsapp": {
            "enabled": False,
            "transport": "local_session",
            "mode": "relay",
            "bot_name": "DeepScientist",
            "command_prefix": "/",
            "auth_method": "qr_browser",
            "session_dir": "~/.deepscientist/connectors/whatsapp",
            "provider": "relay",
            "access_token": None,
            "access_token_env": "WHATSAPP_ACCESS_TOKEN",
            "phone_number_id": None,
            "business_account_id": None,
            "verify_token": None,
            "verify_token_env": "WHATSAPP_VERIFY_TOKEN",
            "api_base_url": "https://graph.facebook.com",
            "api_version": "v21.0",
            "public_callback_url": None,
            "relay_url": None,
            "relay_auth_token": None,
            "dm_policy": "pairing",
            "allow_from": [],
            "group_policy": "allowlist",
            "group_allow_from": [],
            "groups": [],
            "auto_bind_dm_to_active_quest": True,
        },
    }


def default_plugins(home: Path) -> dict:
    return {
        "load_paths": [str(home / "plugins")],
        "enabled": [],
        "disabled": [],
        "allow_unsigned": False,
    }


def default_mcp_servers() -> dict:
    return {"servers": {}}


def default_payload(name: str, home: Path) -> dict:
    if name == "config":
        return default_config(home)
    if name == "runners":
        return default_runners()
    if name == "connectors":
        return default_connectors()
    if name == "plugins":
        return default_plugins(home)
    if name == "mcp_servers":
        return default_mcp_servers()
    raise KeyError(name)
