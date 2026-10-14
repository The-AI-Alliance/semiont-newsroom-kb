---
name: build-source-graph
description: Record how sources' claims relate (corroborates, contradicts, supersedes, derived-from). Each relationship is a Relationship resource its passage is bound to. The assistant reads the passage and decides; no job extracts relationships.
disable-model-invocation: false
user-invocable: true
allowed-tools: Bash, Read, Write
---

You are building the relationship layer of the source graph. `bind-claim-to-source` already wired Claim → Source; this skill records how one source's claim relates to another's.

## What it does

The stack's worker detects mentions of entity types. It has no job that extracts relationships, and a linking job takes no instructions. Deciding that a passage relates two sources is the judgment this skill supplies: yours, reading the passage as the assistant, or the user's.

The method, and the script that records what you decided, are the [`semiont-relate`](https://github.com/The-AI-Alliance/semiont/tree/main/docs/builder/skills/semiont-relate) skill's. A relationship is a resource of its own:

- A **Relationship resource** for each related pair, with entity types `['Relationship', '<type>']`. Its text names the two ends, and a reference on each name is bound to that resource.
- A **reference on the passage** that establishes the relationship, bound to the Relationship resource and tagged with the relationship's type.

## This corpus's relationship types

Declare these with `frame.addEntityTypes` before recording any (alongside `Relationship`):

| Relationship | Recorded when |
|---|---|
| `corroborates` | Source A's claim is independently confirmed by source B |
| `contradicts` | Source A's claim is denied / rebutted by source B |
| `supersedes` | A more recent source's claim replaces an earlier one |
| `derived-from` | A source's claim is itself sourced from another in the corpus |

## SDK verbs

- `browse.resources`, `browse.annotations`, `frame.addEntityTypes`, `yield.resource`, `mark.annotation`, `bind.body`, `gather.referencedBy`

## Guidance for the AI assistant

- **Record only what the language supports.** A relationship is recorded where a passage establishes it, not where two sources merely appear together.
- **One Relationship resource per related pair and type.** A second passage that establishes the same relationship gets a reference bound to the existing resource.
