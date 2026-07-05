# HANDOFF — 30-Minute Rule & Readiness Checklist

## PURPOSE

Ensures codebase is handoff-ready for another developer.

## THE 30-MINUTE RULE

A new developer must be able to in 30 minutes:
1. Clone and run locally
2. Understand what the app does
3. Find where to add a feature
4. Run the test suite
5. Deploy to staging
6. Find third-party service docs
7. Know what breaks under load
8. Access logs if issues

## CHECKLIST

### Documentation
- [ ] README complete and tested
- [ ] API endpoints documented
- [ ] Complex logic commented
- [ ] Setup instructions verified

### Code Quality
- [ ] No TypeScript/linter errors
- [ ] All files <250 lines
- [ ] All functions <50 lines
- [ ] No duplicate code
- [ ] No magic numbers

### Testing
- [ ] >70% coverage
- [ ] All critical paths tested
- [ ] Happy path + 3 error cases
- [ ] Tests pass consistently

### Infrastructure
- [ ] All env vars documented
- [ ] Third-party services documented
- [ ] Deployment process documented
- [ ] Rollback procedure documented

## RULES

- ALWAYS verify handoff checklist
- ALWAYS test setup on clean machine
- ALWAYS document all env vars
- ALWAYS document third-party services
- NEVER declare done without handoff test