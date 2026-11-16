---
name: balance-audit
description: Per-topic named-vs-anonymous source distribution. Flag topics where the corpus relies disproportionately on anonymous sourcing.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are producing a corpus-level balance audit — a `BalanceAudit` aggregate resource that breaks down source-type distribution per Topic.

## What it does

1. Walks every Topic-tagged annotation in the corpus.
2. Walks every source-typed annotation.
3. For each Topic, computes the named-vs-anonymous-vs-document-vs-observation distribution of source-typed claims that overlap with the Topic.
4. Synthesizes a `BalanceAudit` resource with the per-topic table and a flag for any topic where named sourcing is below a threshold.

This is the editorial-balance-check artifact — generated before publication, surfaced in the editor's queue, traceable back to the source claims.

## SDK verbs

`browse.resources`, `browse.annotations`, `yield.resource`.

## Tier-2 parameters

| Var | Default | Purpose |
|---|---|---|
| `NAMED_THRESHOLD` | `0.4` | Minimum named-source proportion below which a topic is flagged. |

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/balance-audit/script.ts'
```

## Output

A `BalanceAudit` resource. Print its resourceId; browse the body in the Semiont UI.
