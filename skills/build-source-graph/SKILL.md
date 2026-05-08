---
name: build-source-graph
description: Wire the Person × Statement × Topic graph; extract inter-source relationships (corroborates, contradicts, supersedes) via a relationship-extraction pass.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are building the relationship layer of the source graph. Pass 1 already wired Claim → Source via `bind-claim-to-source`; this skill now extracts inter-source relationships across the corpus.

## What it does

For every markdown resource, calls `mark.assist(rId, 'linking', { instructions: RELATIONSHIP_INSTRUCTIONS })`. The model identifies passages where one source corroborates, contradicts, or supersedes another and tags the span with a relationship label.

| Relationship | Tagged when |
|---|---|
| `corroborates` | Source A's claim is independently confirmed by source B |
| `contradicts` | Source A's claim is denied / rebutted by source B |
| `supersedes` | A more recent source's claim replaces an earlier one |
| `derived-from` | A source's claim is itself sourced from another in the corpus |

## SDK verbs

`browse.resources`, `mark.assist` (linking with custom instructions).

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/build-source-graph/script.ts'
```
