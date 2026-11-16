---
name: comment-action-items
description: Surface follow-up questions, missing corroboration, redacted-section signals, and editorial concerns across the corpus.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read
---

You are flagging passages that need follow-up — single-source claims, redactions worth FOIA-appealing, denials that warrant investigation, time gaps, missing on-the-record corroboration.

## What it does

`mark.assist(rId, 'commenting', { instructions })` on every markdown resource.

## SDK verbs

`browse.resources`, `mark.assist` (commenting).

## Tier-2 parameters

| Var | Default | Purpose |
|---|---|---|
| `COMMENT_INSTRUCTIONS` | (built-in default) | Override the prompt. |

## Run it

```bash
HOST_ADDR=$(container run --rm node:24-alpine sh -c "ip route | awk '/default/{print \$3}'" 2>/dev/null | tr -d '[:space:]')

container run --rm -v "$(pwd):/work" -w /work \
  -e SEMIONT_API_URL=http://${HOST_ADDR}:4000 \
  -e SEMIONT_USER_EMAIL=admin@example.com \
  -e SEMIONT_USER_PASSWORD=<your-password> \
  node:24-alpine \
  sh -c 'npm install --silent --no-fund @semiont/sdk tsx && npx tsx skills/comment-action-items/script.ts'
```
