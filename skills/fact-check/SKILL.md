---
name: fact-check
description: Per-Claim aggregate listing every supporting and contradicting source with provenance edges. The editorial-review artifact.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are producing a per-Claim FactCheck aggregate — the editorial-review unit. Each Claim resource gets a corresponding FactCheck that lists every supporting source, every contradicting source, and a confidence assessment.

## What it does

For each Claim resource:
1. `gather.annotation` over the Claim's source annotation to assemble context.
2. Walk the corpus for source-relationship annotations (`corroborates`, `contradicts`) targeting this Claim.
3. `yield.fromAnnotation` synthesizes a FactCheck resource: supporting sources, contradicting sources, confidence rating, recommended editorial action.

## SDK verbs

`browse.resources`, `browse.annotations`, `gather.annotation`, `yield.fromAnnotation`.

## CLI args

```
--claim <resourceId>   # Optional. Run for a specific Claim. Default: every Claim resource.
```

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/fact-check/script.ts'
```
