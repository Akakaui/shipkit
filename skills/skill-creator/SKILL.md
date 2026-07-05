# SKILL CREATOR

Last updated: 2026-06-26
Version: 1
Scope: OPEX (orchestrator), Knowledge Ingestion Agent

## PURPOSE

Create new skill files and workflows when the system
needs capabilities it doesn't have. Follows a strict
template to maintain consistency.

## SKILL TEMPLATE

Every new skill file must follow this structure:

```markdown
# [SKILL NAME]

Last updated: [DATE]
Version: 1
Scope: [which agents use this]

## PURPOSE
[One paragraph: what this skill does and when to use it]

## [Main content sections specific to the skill]

## OUTPUT FORMAT
[What the skill produces]

## QUALITY GATES
[Checklist before output is delivered]
```

## CREATION PROCESS

Step 1: Identify the need
  - From skill-scanner suggestions
  - From agent BLOCKED reports
  - From user request
  - From performance gaps

Step 2: Define the skill
  - Name: lowercase, hyphen-separated, max 64 chars
  - Purpose: one paragraph covering what and when
  - Scope: which agents will load it
  - Content: the actual instructions

Step 3: Write the file
  - Location: .opex/skills/[name].skill.md
  - Include all required header fields
  - Include complete content (no placeholders)
  - Version: 1

Step 4: Register the skill
  - Update tools.skill.md if it introduces new tools
  - Update relevant agent files to load the skill
  - Log to skills-log.memory.md

Step 5: Test the skill
  - Have an agent use it on a real task
  - Verify output meets quality gates
  - Adjust if needed

## VERSION INCREMENT RULES

When updating an existing skill:
  1. Read the current version
  2. Make changes
  3. Update the version header:
     Last updated: [NEW DATE]
     Version: [N+1]
     Changed by: [Agent Name]
     Reason: [what changed and why]
  4. Log to skills-log.memory.md

## SKILL NAMING CONVENTIONS

- All lowercase
- Hyphens between words
- Ends with .skill.md
- Descriptive but concise
- Examples:
  - email sequences: email.skill.md
  - video scripts: video-scripts.skill.md
  - client onboarding: client-onboard.skill.md
