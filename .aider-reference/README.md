# shipkit for Aider

**Aider has no plugin system.** shipkit integrates through convention:

1. **Rule files** — Skills are copied to `~/.aider/rules/*.skill.md`
2. **Config loader** — `~/.aider/.aider.conf.yml` references the rules
3. **--read flag** — Load skills at session start: `aider --read ~/.aider/rules/*.skill.md`

## Manual Setup

```bash
# Copy skills as read-only rules
cp -r ~/.cache/shipkit/skills/*/SKILL.md ~/.aider/rules/

# Or use shipkit's aider profile
aider --read ~/.aider/rules/production-hardening.skill.md \
      --read ~/.aider/rules/security.skill.md
```
