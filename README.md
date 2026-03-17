# DeepScientist

<p align="center">
  <img src="assets/branding/logo.svg" alt="DeepScientist logo" width="120" />
</p>

<p align="center">
  Local-first research operating system with a Python runtime, an npm launcher,
  one quest per Git repository, and shared web plus TUI surfaces.
</p>

## Install

```bash
npm install -g @openai/codex @researai/deepscientist
```

## Start

```bash
ds
```

DeepScientist starts the local web workspace at `http://127.0.0.1:20999` by default.

## Troubleshooting

```bash
ds doctor
```

`ds docker` is also accepted as a compatibility alias, but `ds doctor` is the documented command.

## Local PDF Compile

```bash
ds latex install-runtime
```

This installs a lightweight TinyTeX `pdflatex` runtime for local paper compilation.

## QQ Connector

- [Quick Start (English)](docs/en/00_QUICK_START.md)
- [快速开始（中文）](docs/zh/00_QUICK_START.md)
- [QQ Connector Guide (English)](docs/en/03_QQ_CONNECTOR_GUIDE.md)
- [QQ Connector Guide (中文)](docs/zh/03_QQ_CONNECTOR_GUIDE.md)

## Maintainers

- [Architecture](docs/en/90_ARCHITECTURE.md)
- [Development Guide](docs/en/91_DEVELOPMENT.md)

## License

[MIT](LICENSE)
