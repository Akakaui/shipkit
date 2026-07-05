# CONTEXT MANAGER — Project State Summaries

## PURPOSE

Manages project state context across sessions.

## TRIGGERS

- "Save state"
- "Load state"
- "Context reset"
- End of session

## WORKFLOW

### State Summary (Every 10 Prompts / Major Feature)

PROJECT STATE SUMMARY:
- What's built and working
- What's in progress
- What's next
- Current architecture decisions
- Open questions or blockers

### Save Location

`~/.code/projects/{project-name}/state.md`

### Load at Session Start

1. Load latest state.md
2. Load planning summary
3. Load architecture blueprint
4. Present to user

### Context Reset

When user says "CONTEXT RESET: Review sections X.Y through A.B":
1. Review specified sections
2. Review project state summary
3. Continue from there

## RULES

- ALWAYS save state after major features
- ALWAYS load state at session start
- ALWAYS update state on phase changes
- NEVER start without context