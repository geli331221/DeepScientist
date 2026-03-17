# 91 Development Guide: Maintainer Workflow and Repository Guide

This guide is for maintainers and contributors working inside the repository.

For architecture, read [90_ARCHITECTURE.md](90_ARCHITECTURE.md) first.

## Local Prerequisites

Recommended baseline:

- Node.js `>=18.18`
- npm `>=9`
- Python `>=3.11`
- Git on `PATH`

Optional local toolchains:

- Codex CLI for the runnable agent path
- TinyTeX or another LaTeX distribution if you want local PDF compilation

## Common Local Flows

### Install into a separate local runtime tree

```bash
bash install.sh
```

### Install plus a managed TinyTeX runtime

```bash
bash install.sh --with-tinytex
```

### Start the product

```bash
ds
```

### Check local health

```bash
ds doctor
```

### Check or install the managed LaTeX runtime

```bash
ds latex status
ds latex install-runtime
```

## Build Commands

Build the web UI:

```bash
npm --prefix src/ui install
npm --prefix src/ui run build
```

Build the TUI:

```bash
npm --prefix src/tui install
npm --prefix src/tui run build
```

## Test Commands

Quick Python test run:

```bash
pytest
```

Useful focused checks:

```bash
python3 -m compileall src/deepscientist
node -c bin/ds.js
npm pack --dry-run --ignore-scripts
```

## Release-Oriented Checks

Before publishing or cutting a release, verify:

1. Python tests pass.
2. Web and TUI bundles build cleanly.
3. `npm pack --dry-run --ignore-scripts` succeeds.
4. README and linked docs match the current runtime behavior.
5. Any new config, route, or quest-state fields have matching tests.

## Managed Runtime Tools

Managed local tools live under `src/deepscientist/runtime_tools/`.

The goal is to keep optional local helper runtimes consistent and easy to extend.

### Current structure

- `models.py`
  - provider protocol and shared types
- `registry.py`
  - registration and lookup
- `builtins.py`
  - built-in registrations
- `service.py`
  - high-level access for runtime code
- `tinytex.py`
  - TinyTeX adapter

### Registration flow

Every managed tool should follow the same pattern:

1. Add a provider module under `src/deepscientist/runtime_tools/`.
2. Expose a provider object with:
   - `tool_name`
   - `status()`
   - `install()`
   - `resolve_binary(binary)`
3. Register it in `runtime_tools/builtins.py`.
4. Access it through `RuntimeToolService`, not by scattering direct imports across the repo.
5. Document it if it changes user-visible install or troubleshooting behavior.

### Minimal provider example

```python
from pathlib import Path


class ExampleRuntimeTool:
    tool_name = "example"

    def __init__(self, home: Path) -> None:
        self.home = home

    def status(self) -> dict:
        return {"ok": True, "summary": "Example tool is healthy."}

    def install(self) -> dict:
        return {"ok": True, "changed": False, "summary": "Nothing to install."}

    def resolve_binary(self, binary: str) -> dict:
        return {"binary": binary, "path": None, "source": None, "root": None, "bin_dir": None}
```

Register it in `runtime_tools/builtins.py`:

```python
from .registry import register_runtime_tool
from .example import ExampleRuntimeTool


def register_builtin_runtime_tools(*, home=None) -> None:
    register_runtime_tool("example", lambda **kwargs: ExampleRuntimeTool(kwargs["home"]))
```

Use it from runtime code:

```python
from deepscientist.runtime_tools import RuntimeToolService


service = RuntimeToolService(home)
status = service.status("example")
match = service.resolve_binary("example-binary", preferred_tools=("example",))
```

### Rules for adding a new managed tool

- keep the tool optional unless it is absolutely required for the core product
- do not add a public MCP namespace for it
- do not wire it directly into unrelated modules when `RuntimeToolService` is enough
- prefer install locations under `~/DeepScientist/runtime/tools/`
- keep clear source reporting such as `tinytex` versus `path`
- add tests for registration, status, and binary resolution

## Documentation Rules

When behavior changes:

- update user docs in `docs/en/` and `docs/zh/` if the user-facing workflow changed
- update `90_ARCHITECTURE.md` if subsystem structure or ownership changed
- update this file if development or registration workflow changed

## Repository Hygiene

- do not commit `node_modules/`, build output, caches, or local secrets
- do not commit workstation-specific absolute paths
- keep changes coherent and narrowly scoped
- prefer current runtime behavior and tests over stale comments or deleted historical docs
