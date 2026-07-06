# shipkit for Aider

**Aider has no plugin system.** shipkit integrates through convention:

1. **Rule files** — Skills are copied to `~/.aider/rules/*.skill.md`
2. **Config loader** — `~/.aider/.aider.conf.yml` references the rules
3. **--read flag** — Load skills at session start: `aider --read ~/.aider/rules/*.skill.md`

## Manual Setup

```bash
# Clone shipkit then copy skills as read-only rules
git clone https://github.com/Akakaui/shipkit.git
mkdir -p ~/.aider/rules
cp shipkit/skills/*/SKILL.md ~/.aider/rules/

# Or just use shipkit CLI
npx @akakaui/shipkit init
```
