# GIT WORKFLOW — Branches, Commits, PRs

## PURPOSE

Enforces consistent Git workflow.

## BRANCH STRATEGY

- `main` — production only
- `develop` — integration branch
- `feature/*` — individual features
- `hotfix/*` — emergency fixes

## COMMIT FORMAT

Conventional commits:
- `feat:` new feature
- `fix:` bug fix
- `refactor:` code improvement
- `test:` test additions
- `docs:` documentation
- `chore:` maintenance

Example: `feat: add user profile edit modal`

## WORKFLOW

1. Create feature branch from `develop`
2. Make small, atomic commits
3. Run tests before each commit
4. Push feature branch
5. Create PR to `develop`
6. After review, merge to `develop`
7. Release from `develop` to `main`

## RULES

- ALWAYS use conventional commits
- ALWAYS run tests before commit
- ALWAYS create feature branches
- ALWAYS PR to develop (never direct to main)
- NEVER commit directly to main
- NEVER use vague commit messages
- NEVER commit without tests