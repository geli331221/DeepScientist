# Contributing to DeepScientist

Thank you for contributing.

This repository is intended to stay small, readable, and reliable. Please optimize for
clarity, correctness, and maintainability over feature volume.

## Before You Start

- read [README.md](README.md)
- read [docs/en/ARCHITECTURE.md](docs/en/ARCHITECTURE.md)
- read [docs/en/DEVELOPMENT.md](docs/en/DEVELOPMENT.md)
- read the relevant user docs under `docs/en/` or `docs/zh/`
- inspect the existing code before proposing a new abstraction
- prefer small, coherent changes over large mixed pull requests

## Development Setup

Requirements:

- Node.js `>=18.18`
- npm `>=9`
- Python `>=3.11`
- Git on `PATH`

Common local setup:

```bash
bash install.sh
npm --prefix src/ui install
npm --prefix src/tui install
```

Build the UI bundles when needed:

```bash
npm --prefix src/ui run build
npm --prefix src/tui run build
```

Run tests:

```bash
pytest
```

## Contribution Principles

Please keep these contracts intact:

- one quest = one Git repository
- Python remains the authoritative runtime
- npm remains the launcher and packaging path
- only `memory`, `artifact`, and `bash_exec` are public built-in MCP namespaces
- web UI and TUI must stay aligned on the same daemon API contract
- prompts and skills should carry workflow behavior whenever possible

## Documentation Rules

- keep user-facing docs in `docs/en/` and `docs/zh/`
- do not add internal planning notes or temporary checklists to `docs/`
- update docs when behavior or architecture changes
- do not commit local machine paths or private workstation references

## Code Style

- prefer simple files and direct control flow
- avoid unnecessary abstraction layers
- keep registries small and explicit
- prefer durable file- and Git-based state over hidden runtime state
- use ASCII by default unless a file already uses non-ASCII or the content clearly needs it

## Pull Request Scope

A good pull request usually has one clear purpose, for example:

- one runtime fix
- one API contract change
- one connector improvement
- one prompt and skill update
- one documentation cleanup

Avoid combining unrelated refactors, UI redesign, connector logic, and packaging changes in one PR.

## Tests And Validation

When relevant, update:

- unit tests
- API contract tests
- prompt and skill tests
- documentation that describes the affected behavior

For packaging changes, also run:

```bash
npm pack --dry-run
```

## Open-Source Hygiene

Do not commit:

- `node_modules/`
- `dist/` build output
- `.turbo/`
- `__pycache__/`
- `.pytest_cache/`
- local secrets
- local absolute paths

## Issues And Proposals

When proposing a non-trivial change, include:

- the problem being solved
- the expected behavior
- the main files or subsystems affected
- any migration or compatibility concerns

## License

By contributing to this repository, you agree that your contributions are licensed under the [MIT License](LICENSE).
