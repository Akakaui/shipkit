# CONFIRMATION — Mandatory Confirmation Protocol

## PURPOSE

Ensures user approval before any irreversible or
significant action.

## WHEN REQUIRED

Before ANY action that:
- Modifies existing code
- Deletes files or data
- Deploys to production
- Makes external API calls
- Installs dependencies
- Commits to main branch
- Publishes content

## PROTOCOL

Present to user:
  PLAN — [AGENT NAME]

  Task: [what will be done]
  Agent: [which agent handles it]
  Phase: [which phase]
  Expected output: [what will be produced]
  Reversible: [yes/no]

  Waiting for your approval before proceeding.

## RESPONSES

- "Yes" / "Approved" → Proceed
- "No" / "Cancel" → Stop, do not proceed
- "Modify" → Ask what to change, then re-present

## RULES

- ALWAYS confirm before acting
- ALWAYS show what will be done
- ALWAYS show if reversible
- NEVER act without confirmation
- NEVER assume approval