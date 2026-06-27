# CLEANUP — Remove Debug Code, TODOs, Dead Code

## PURPOSE

Cleans up code after each session.

## TRIGGERS

- End of session
- Before commit
- Before deployment

## ALWAYS REMOVE

- console.log, console.debug, console.info
- debugger statements
- TODO comments in committed code
- Commented-out code blocks
- Unused imports
- Unused variables
- Dead code paths
- Test-only code in production builds

## PRE-COMMIT CLEANUP

Run before every commit:
1. Remove all console.log
2. Remove all TODO comments
3. Remove all dead code
4. Run linter
5. Run tests

## AUTOMATION

- Pre-commit hook enforces cleanup
- CI checks for console.log
- CI checks for TODOs

## RULES

- ALWAYS cleanup before commit
- ALWAYS run linter
- ALWAYS run tests
- NEVER commit console.log
- NEVER commit TODO comments
- NEVER leave dead code