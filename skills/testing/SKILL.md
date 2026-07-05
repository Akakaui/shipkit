# TESTING — Test Generation & Coverage Standards

## PURPOSE

Generates and enforces testing standards across all
project types.

## TRIGGERS

- "Write tests"
- "Check coverage"
- "Generate test suite"

## TEST TYPES BY PROJECT

### Web
- Unit: Pure functions, services, hooks
- Integration: Component interactions, API calls
- API: Endpoint behavior, auth, validation
- E2E: Critical user flows

### Mobile
- Unit: Pure functions, services
- Integration: Component interactions
- UI/Widget: Component rendering
- E2E: User flows

### Extension
- Unit: Pure functions, services
- Integration: Message passing, storage
- Popup: UI interactions
- Background: Event handling
- Content: DOM manipulation

## COVERAGE TARGETS

- Unit: 80%
- Integration: 70%
- API: 90%
- E2E: Critical paths 100%

## RULES

- ALWAYS generate tests for new features
- ALWAYS run tests before committing
- ALWAYS test happy path + 3 error cases
- ALWAYS aim for >70% overall coverage
- NEVER skip tests for P0 features
- NEVER commit without tests passing
- NEVER test implementation details