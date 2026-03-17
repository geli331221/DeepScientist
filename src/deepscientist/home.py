from __future__ import annotations

from pathlib import Path

from .shared import ensure_dir


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def default_home() -> Path:
    return Path.home() / "DeepScientist"


def ensure_home_layout(home: Path) -> dict[str, Path]:
    runtime = ensure_dir(home / "runtime")
    ensure_dir(runtime / "venv")
    ensure_dir(runtime / "bundle")
    ensure_dir(runtime / "tools")

    config = ensure_dir(home / "config")
    ensure_dir(config / "baselines")
    ensure_dir(config / "baselines" / "entries")

    memory = ensure_dir(home / "memory")
    for kind in ("papers", "ideas", "decisions", "episodes", "knowledge", "templates"):
        ensure_dir(memory / kind)

    quests = ensure_dir(home / "quests")
    plugins = ensure_dir(home / "plugins")
    logs = ensure_dir(home / "logs")
    cache = ensure_dir(home / "cache")
    ensure_dir(cache / "skills")

    return {
        "home": home,
        "runtime": runtime,
        "config": config,
        "memory": memory,
        "quests": quests,
        "plugins": plugins,
        "logs": logs,
        "cache": cache,
    }
