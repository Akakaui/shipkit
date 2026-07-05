# DEPLOYMENT — Environment Setup & CI/CD

## PURPOSE

Sets up deployment environments and CI/CD pipelines.

## TRIGGERS

- "Deploy my app"
- "Set up CI/CD"
- "Configure environments"

## ENVIRONMENTS

- Dev: Local development
- Staging: Pre-production testing
- Production: Live users

## CI/CD PIPELINE

1. Lint → 2. Test → 3. Build → 4. Deploy → 5. Verify → 6. Monitor

## DEPLOYMENT TARGETS

### Web
- Vercel, Netlify (static/SSR)
- AWS, GCP (full control)

### Mobile
- Expo EAS Build
- App Store / Play Store
- TestFlight / Internal Testing

### Extension
- Chrome Web Store
- Manual .crx distribution

## RULES

- ALWAYS test in staging first
- ALWAYS get approval for production
- ALWAYS have rollback procedure
- ALWAYS monitor after deployment
- NEVER deploy without tests passing
- NEVER skip security scanning
- NEVER hardcode secrets