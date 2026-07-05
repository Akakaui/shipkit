# PERFORMANCE — Optimization & Targets

## PURPOSE

Ensures performance optimization across all project types.

## TRIGGERS

- "Optimize performance"
- "Check bundle size"
- "Improve load time"

## TARGETS

### Web

- Lighthouse score >90
- Initial load <3 seconds
- Bundle size <500KB (before splitting)
- No memory leaks

### Mobile

- App startup <2 seconds
- Frame rate 60fps
- Memory usage <100MB
- Battery impact minimal

### Extension

- Background script <10MB memory
- Popup open <100ms
- Content script injection <50ms

## OPTIMIZATION TECHNIQUES

### Frontend

- Lazy loading / code splitting
- Image/asset optimization
- Bundle size monitoring
- Caching strategy (CDN, Redis)

### Backend

- Database query optimization
- Indexing strategy
- Caching strategy
- Connection pooling

### Mobile

- Image loading optimization
- Network request batching
- Offline sync efficiency

### Extension

- Background script efficiency
- Memory leak prevention
- Storage quota management

## RULES

- ALWAYS lazy load routes
- ALWAYS optimize images
- ALWAYS monitor bundle size
- ALWAYS index database queries
- ALWAYS cache appropriately
- NEVER skip performance checks
- NEVER deploy without Lighthouse >90