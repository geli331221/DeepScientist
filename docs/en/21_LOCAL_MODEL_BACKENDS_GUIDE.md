# 21 Local Model Backends Guide: vLLM, Ollama, and SGLang

This guide explains how to run DeepScientist against a local OpenAI-compatible model backend through Codex.

The key point is simple:

- current Codex CLI requires `wire_api = "responses"`
- a backend that only works through `/v1/chat/completions` is not enough
- you must verify `/v1/responses` before expecting `ds` or `ds doctor` to succeed

There is one practical fallback:

- if your backend is chat-only, you may still be able to use it through **Codex CLI `0.57.0`**
- that older path can still work with `wire_api = "chat"` when the provider is configured at the top level
- DeepScientist now checks this automatically during the Codex startup probe; if it sees `wire_api = "chat"` on any active provider config, it requires `codex-cli 0.57.0` before continuing

## 1. What DeepScientist actually depends on

DeepScientist does not talk to vLLM, Ollama, or SGLang directly.

It talks to:

- `codex`
- and `codex` talks to your configured provider profile in `~/.codex/config.toml`

So the compatibility chain is:

1. your local backend
2. Codex profile
3. Codex startup probe
4. DeepScientist runner

If step 2 or step 3 fails, DeepScientist cannot start the Codex runner successfully.

## 2. The current Codex rule you must know

On the current Codex CLI:

- `wire_api = "responses"` is supported
- `wire_api = "chat"` is rejected

In practice that means:

- `vLLM`: recommended if its OpenAI-compatible server exposes `/v1/responses`
- `Ollama`: only use it if your installed version exposes `/v1/responses`
- `SGLang`: if your deployment only supports `/v1/chat/completions`, it is not compatible with the latest Codex runner

## 2.1 Support summary

| Backend | `/v1/chat/completions` | `/v1/responses` | Latest Codex | Codex `0.57.0` fallback |
|---|---|---|---|---|
| vLLM | yes | yes | supported | usually unnecessary |
| Ollama | yes | depends on version | supported only when `/v1/responses` works | possible if it is chat-only |
| SGLang | yes | often missing or incomplete | not supported when it is chat-only | possible fallback path |

## 3. Test the backend first

Before touching DeepScientist, verify the backend directly.

### Step 1: list models

```bash
curl http://127.0.0.1:8004/v1/models \
  -H "Authorization: Bearer 1234"
```

You need one real model id from this output, for example:

```text
/model/gpt-oss-120b
```

### Step 2: test chat completions

```bash
curl http://127.0.0.1:8004/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 1234" \
  -d '{
    "model": "/model/gpt-oss-120b",
    "messages": [
      { "role": "user", "content": "Reply with exactly HELLO." }
    ]
  }'
```

If this works, the backend is at least OpenAI-chat-compatible.

### Step 3: test Responses API

```bash
curl http://127.0.0.1:8004/v1/responses \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 1234" \
  -d '{
    "model": "/model/gpt-oss-120b",
    "input": "Reply with exactly HELLO."
  }'
```

This is the decisive test.

If `/v1/responses` fails, the latest Codex CLI will not work with this backend profile.

## 4. What we actually observed on this server

We tested the local backend at `http://127.0.0.1:8004/v1`.

Observed behavior:

- `GET /v1/models` succeeded
- `POST /v1/chat/completions` succeeded
- `POST /v1/responses` returned `500 Internal Server Error`
- the `/v1/models` payload reported `owned_by: "sglang"`

So this specific `8004` deployment behaves like a chat-compatible SGLang-style server, not a Codex-compatible Responses backend.

That means:

- it can answer raw chat requests
- but it cannot currently be used by the latest Codex runner
- and therefore DeepScientist cannot use it through the normal Codex path

We also tested an older Codex path:

- latest Codex + `wire_api = "responses"` failed against this backend
- Codex `0.57.0` + top-level `model_provider` / `model` + `wire_api = "chat"` succeeded

So for this server specifically:

- **latest Codex path**: no
- **Codex `0.57.0` fallback**: yes

## 5. Codex profile example for a local Responses-compatible backend

If your backend really supports `/v1/responses`, create a profile like this:

```toml
[model_providers.local_vllm]
name = "local_vllm"
base_url = "http://127.0.0.1:8004/v1"
env_key = "LOCAL_API_KEY"
wire_api = "responses"
requires_openai_auth = false

[profiles.local_vllm]
model = "/model/gpt-oss-120b"
model_provider = "local_vllm"
```

Then test Codex directly first:

```bash
export LOCAL_API_KEY=1234
codex exec --profile local_vllm --json --cd /tmp --skip-git-repo-check - <<'EOF'
Reply with exactly HELLO.
EOF
```

If this fails, do not continue to DeepScientist yet.

## 5.1 Chat-only fallback for Codex `0.57.0`

If your backend only supports `/v1/chat/completions`, you can try this fallback path:

1. install Codex `0.57.0`
2. use `wire_api = "chat"`
3. put `model_provider` and `model` at the top level

Example:

```toml
model = "/model/gpt-oss-120b"
model_provider = "localchat"
approval_policy = "never"
sandbox_mode = "workspace-write"

[model_providers.localchat]
name = "localchat"
base_url = "http://127.0.0.1:8004/v1"
env_key = "LOCAL_API_KEY"
wire_api = "chat"
requires_openai_auth = false
```

Then test:

```bash
export LOCAL_API_KEY=1234
codex exec --json --cd /tmp --skip-git-repo-check - <<'EOF'
Reply with exactly HELLO.
EOF
```

If this older Codex path works, DeepScientist can usually reuse it with the same runner binary and profile strategy.

## 6. DeepScientist commands after Codex works

Once the direct Codex check works, run:

```bash
ds doctor --codex-profile local_vllm
ds --codex-profile local_vllm
```

`ds doctor` is the canonical command.

`ds docker` is only a legacy alias for `ds doctor`; it is not a Docker deployment command.

If you want to persist it in DeepScientist:

```yaml
codex:
  enabled: true
  binary: codex
  config_dir: ~/.codex
  profile: local_vllm
  model: inherit
  model_reasoning_effort: high
  approval_policy: never
  sandbox_mode: danger-full-access
```

## 7. Backend compatibility summary

### vLLM

Recommended.

Use it when:

- `/v1/models` works
- `/v1/responses` works
- the model id is visible and stable

If those are true, vLLM is the cleanest current local path for Codex + DeepScientist.

### Ollama

Conditionally supported.

Use it only when:

- your Ollama version exposes `/v1/responses`
- your target model works through that endpoint

If Ollama only gives you chat-completions semantics, it is not enough for the latest Codex CLI, but it may still be usable through Codex `0.57.0`.

### SGLang

Be careful.

If your SGLang deployment behaves like this:

- `/v1/chat/completions` works
- `/v1/responses` fails

then it is not currently compatible with the latest Codex runner.

If you must use that backend anyway, the realistic fallback is Codex `0.57.0` with `wire_api = "chat"`.

## 8. What to do if you only have chat-completions

If your backend only supports `/v1/chat/completions`, you currently have three practical options:

1. switch to a Responses-compatible backend such as vLLM
2. upgrade to an Ollama release that really exposes `/v1/responses`
3. downgrade the Codex CLI path to `0.57.0` and use `wire_api = "chat"`
4. place a Responses-compatible proxy in front of the backend

Right now, this is a Codex CLI limitation, not a DeepScientist-only setting mistake.

## 9. Recommended workflow

Use this order every time:

1. test `/v1/models`
2. test `/v1/responses`
3. test `codex exec --profile <name>`
4. test `ds doctor --codex-profile <name>`
5. only then launch `ds --codex-profile <name>`

If step 2 fails, stop there. Do not expect DeepScientist to succeed through the latest Codex path.
