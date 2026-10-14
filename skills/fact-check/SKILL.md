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
3. `yield.delegate` synthesizes a FactCheck resource: supporting sources, contradicting sources, confidence rating, recommended editorial action.

## SDK verbs

`browse.resources`, `browse.annotations`, `gather.annotation`, `yield.delegate`.

## CLI args

```
--claim <resourceId>   # Optional. Run for a specific Claim. Default: every Claim resource.
```

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  node:24-alpine \
  sh -c 'npm ci --no-audit --no-fund && npx tsx skills/fact-check/script.ts'
```

The script prints an address: open it in a browser and approve the sign-in. [Signing in](https://github.com/The-AI-Alliance/semiont/blob/main/docs/builder/SIGN-IN.md) has the other ways a script can sign in.
