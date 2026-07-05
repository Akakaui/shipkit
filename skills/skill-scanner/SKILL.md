# SKILL SCANNER

Last updated: 2026-06-26
Version: 1
Scope: OPEX (orchestrator)

## PURPOSE

Read the full arsenal of skill files, identify gaps,
and suggest new skills that should be created based on
what the system is missing.

## HOW IT WORKS

Step 1: Scan all files in .opex/skills/
Step 2: Read each skill's description and scope
Step 3: Compare against:
  - Active goals (what capabilities are needed)
  - Agent requirements (what skills agents reference)
  - Performance gaps (what's not working)
  - Tool availability (what tools exist but aren't skilled)

Step 4: Generate suggestions report

## SCAN OUTPUT FORMAT

  SKILL SCAN — [Date]

  ## Current Skills ([count])
  [list of all skills with one-line description]

  ## Referenced but Missing
  [skills that agents reference but don't exist yet]

  ## Recommended New Skills
  [skills that would fill identified gaps]
    Skill: [name]
    Purpose: [what it would do]
    Agents that would use it: [list]
    Priority: [high/medium/low]

  ## Redundant Skills
  [skills that overlap or could be merged]

  ## Outdated Skills
  [skills with old version headers or obsolete content]

## WHEN TO RUN

- After any major session
- Monthly as part of system maintenance
- When agents report "skill not found" errors
- When performance is declining
