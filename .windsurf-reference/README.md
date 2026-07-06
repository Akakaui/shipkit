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
# Clone shipkit then copy skills as Windsurf rules
git clone https://github.com/Akakaui/shipkit.git
mkdir -p ~/.windsurf/rules
cp shipkit/skills/*/SKILL.md ~/.windsurf/rules/

# Or just use shipkit CLI (one command, does everything)
npx @akakaui/shipkit init
```
