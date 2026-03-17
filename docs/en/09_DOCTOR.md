# 09 `ds doctor`: Repair Startup and Environment Problems

Use `ds doctor` when DeepScientist does not start cleanly after installation.

## Recommended flow

1. Install DeepScientist and Codex:

   ```bash
   npm install -g @openai/codex @researai/deepscientist
   ```

2. Try to start DeepScientist:

   ```bash
   ds
   ```

3. If startup fails or looks unhealthy, run:

   ```bash
   ds doctor
   ```

4. Read the checks from top to bottom and fix the failed items first.

5. Run `ds doctor` again until all checks are healthy, then run `ds`.

## What `ds doctor` checks

- local Python runtime health
- whether `~/DeepScientist` exists and is writable
- whether `git` is installed and configured
- whether required config files are valid
- whether the current release is still using `codex` as the runnable runner
- whether the Codex CLI can be found and passes a startup probe
- whether an optional local `pdflatex` runtime is available for paper PDF compilation
- whether the web and TUI bundles exist
- whether the configured web port is free or already running the correct daemon

## Common fixes

### Codex is missing

Run:

```bash
npm install -g @openai/codex
```

### Codex is installed but not logged in

Run:

```bash
codex
```

Finish login once, then rerun `ds doctor`.

### Local paper PDF compilation is unavailable

DeepScientist can compile papers without a full TeX Live install if you add a lightweight TinyTeX runtime:

```bash
ds latex install-runtime
```

If you prefer a system package instead, install a distribution that provides `pdflatex` and `bibtex`.

### Port `20999` is busy

If it is your managed daemon:

```bash
ds --stop
```

Then run `ds` again.

If another service already uses the port, change `ui.port` in:

```text
~/DeepScientist/config/config.yaml
```

### Git user identity is missing

Run:

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### Claude was enabled by mistake

Current open-source releases keep `claude` as a TODO/reserved slot only.
Set it back to disabled in:

```text
~/DeepScientist/config/runners.yaml
```

## Notes

- `ds docker` is kept as a compatibility alias, but the official command is `ds doctor`.
- The normal browser URL is `http://127.0.0.1:20999`.
