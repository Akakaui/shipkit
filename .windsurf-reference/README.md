# shipkit for Windsurf

**Windsurf has no plugin system.** shipkit integrates through `.windsurf/rules/*.md` files with YAML frontmatter.

## Rule Format

Each rule file has YAML frontmatter that tells Windsurf when to trigger:

```yaml
---
name: production-hardening
description: shipkit prod-readiness checklist
trigger: always_on
---

# Content follows here (the skill markdown)
```

## Trigger Types

- `always_on` — Active in every session
- `glob: "*.ts"` — Activates when editing TypeScript files
- `model_decision` — Lets the model decide when to use it
- `manual` — Only when user explicitly requests

## Installation

```bash
# Copy skills as Windsurf rules
cp -r ~/.cache/shipkit/skills/*/SKILL.md ~/.windsurf/rules/*.windsurf-rule.md

# Or use shipkit CLI
npx @akakaui/shipkit init
```
