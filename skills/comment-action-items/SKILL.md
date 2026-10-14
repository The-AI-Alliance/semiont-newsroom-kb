---
name: comment-action-items
description: Surface follow-up questions, missing corroboration, redacted-section signals, and editorial concerns across the corpus.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are flagging passages that need follow-up — single-source claims, redactions worth FOIA-appealing, denials that warrant investigation, time gaps, missing on-the-record corroboration.

## What it does

`mark.delegate(rId, 'commenting', { instructions })` on every markdown resource.

## SDK verbs

`browse.resources`, `mark.delegate` (commenting).

## Tier-2 parameters

| Var | Default | Purpose |
|---|---|---|
| `COMMENT_INSTRUCTIONS` | (built-in default) | Override the prompt. |

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  node:24-alpine \
  sh -c 'npm ci --no-audit --no-fund && npx tsx skills/comment-action-items/script.ts'
```

The script prints an address: open it in a browser and approve the sign-in. [Signing in](https://github.com/The-AI-Alliance/semiont/blob/main/docs/builder/SIGN-IN.md) has the other ways a script can sign in.
