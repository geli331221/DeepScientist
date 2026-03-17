# 07 Memory and MCP: Built-in MCP and Memory Protocol

This note defines the intended meaning of the three built-in DeepScientist MCP namespaces:

- `memory`
- `artifact`
- `bash_exec`

The goal is simple:

- `artifact` drives the quest
- `memory` reduces rediscovery cost
- `bash_exec` runs durable shell work

## 1. When to use which MCP

Use `memory` when the output should help a later turn remember something reusable:

- paper notes
- failure patterns
- debugging lessons
- selected idea rationale
- stable evaluation caveats

For ideation specifically:

- review prior quest idea cards before proposing a new idea
- review prior experiment outcomes and failure patterns before broad new literature expansion
- use old idea and experiment memory as references and constraints
- do not silently treat a past line as the current active idea unless it is explicitly selected again

Use `artifact` when the output changes or reports quest state:

- idea creation or revision
- branch/worktree transitions
- experiment records
- analysis campaign records
- progress or milestone updates
- decisions and approvals
- connector-facing interaction state

Use `bash_exec` when a command should stay durable and inspectable:

- training runs
- long evaluations
- monitored scripts
- commands that may need `read`, `list`, or `kill` later

## 2. Memory tool semantics

### `memory.list_recent(...)`

Purpose:

- recover local context quickly
- rebuild state after pause/restart

Use it:

- at turn start
- when resuming a stopped quest
- before choosing which specific cards to inspect

Do not use it:

- as the only basis for a route decision
- as a replacement for targeted search

Example:

```text
memory.list_recent(scope="quest", limit=5, kind="knowledge")
```

### `memory.search(...)`

Purpose:

- targeted retrieval before repeating work

Use it:

- before broad literature search
- before another retry on a recurring failure
- before choosing or revising an idea
- before asking the user something that may already be answered durably

Recommended search patterns:

- paper discovery:
  - `kind="papers"`
- route rationale:
  - `kind="decisions"`
- recurring bug or confounder:
  - `kind="episodes"`
- stable reusable rule:
  - `kind="knowledge"`

Examples:

```text
memory.search(query="imagenet official split baseline", scope="both", kind="papers", limit=6)
memory.search(query="metric wiring mismatch adapter", scope="quest", kind="episodes", limit=5)
memory.search(query="adapter baseline novelty", scope="both", kind="ideas", limit=6)
```

### `memory.read(...)`

Purpose:

- inspect one specific card after retrieval

Use it:

- after `list_recent` or `search` returned a card that clearly matters now

Do not use it:

- on dozens of cards in one turn

Example:

```text
memory.read(path="~/DeepScientist/quests/q-xxxx/memory/knowledge/metric-contract.md")
```

### `memory.write(...)`

Purpose:

- persist a durable reusable finding

Use it after:

- a useful paper reading result
- a non-trivial debugging episode
- a stable evaluation rule
- a selected or rejected idea with reason

Do not use it for:

- generic chat summaries
- temporary progress pings
- information already captured better as an artifact record

Suggested body shape:

1. context
2. action or observation
3. outcome
4. interpretation
5. boundaries
6. evidence paths
7. retrieval hint for future turns

Example:

```md
---
id: knowledge-1234abcd
type: knowledge
title: Metric comparison is valid only under the official validation split
quest_id: q-xxxx
scope: quest
tags:
  - stage:baseline
  - topic:metric-contract
stage: baseline
confidence: high
evidence_paths:
  - artifacts/baselines/verification_report.md
retrieval_hints:
  - baseline comparison
  - metric contract
updated_at: 2026-03-11T18:00:00+00:00
---

Context: baseline verification on the official benchmark setup.

Observation: numbers matched only when the official validation split was used.

Interpretation: any comparison against this baseline is invalid under custom splits.

Boundary: this rule is benchmark-specific and should not be promoted globally unless it recurs across quests.
```

### `memory.promote_to_global(...)`

Purpose:

- copy a proven reusable quest-local lesson into global memory

Use it only when:

- the lesson is not just repo-specific noise
- it has become stable
- another quest would likely benefit

## 3. Artifact versus memory

Write both only when they serve different roles.

Example:

- main experiment finished:
  - `artifact.record_main_experiment(...)` stores the official run record
  - `memory.write(kind="knowledge", ...)` is optional and should capture only the reusable lesson, such as a stable metric caveat or debugging rule

Do not replace an experiment artifact with a memory card.
Do not replace a reusable lesson with a progress artifact.

## 4. Bash exec usage

Use `bash_exec` for monitored commands:

```text
bash_exec.bash_exec(command="python train.py --config configs/main.yaml", mode="detach", workdir="<quest workspace>")
```

Then inspect:

```text
bash_exec.bash_exec(mode="list", status="running")
bash_exec.bash_exec(mode="read", id="<bash_id>")
```

Use `kill` only when the quest truly needs to stop the session.

## 5. Prompt-level expectations

The agent should normally follow this discipline:

1. `memory.list_recent(...)` at turn start or resume
2. `memory.search(...)` before repeated work
3. `memory.read(...)` on the few selected cards
4. `artifact` for quest state changes and reports
5. `bash_exec` for durable shell work
6. `memory.write(...)` only after a real durable finding appears

## 6. UI expectation

In `/projects/{id}` Studio trace:

- `memory.*` calls should render as structured cards, not opaque raw JSON
- the card should show:
  - operation type
  - scope
  - kind
  - title or query
  - matching items or saved card summary

If the agent is not calling memory at all, the problem is prompt/skill behavior.
If the agent is calling memory but Studio still looks like raw logs, the problem is UI rendering.
