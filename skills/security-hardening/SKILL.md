---
name: security-hardening
description: OWASP Top 10, authentication, encryption, SBOM, compliance hardening. Use when shipping to production or when security audit reveals gaps.
---

# SECURITY HARDENING SKILL

## PURPOSE

Hardens applications against OWASP Top 10 vulnerabilities,
ensures proper authentication and encryption, and maintains
compliance evidence.

## CHECKLIST

### Authentication
- [ ] Password hashing (bcrypt/argon2)
- [ ] MFA/2FA support
- [ ] Session management (secure cookies, short expiry)
- [ ] OAuth 2.0 / OIDC for SSO
- [ ] Rate limiting on login endpoints

### Encryption
- [ ] TLS 1.3 everywhere
- [ ] HTTPS redirect (HSTS)
- [ ] Encrypted secrets at rest (AES-256)
- [ ] Proper key management (no hardcoded keys)

### OWASP Top 10
- [ ] SQL/NoSQL injection prevention (parameterized queries)
- [ ] XSS prevention (CSP headers, output encoding)
- [ ] CSRF protection (same-origin, tokens)
- [ ] Insecure deserialization checks
- [ ] Known vulnerability scanning (npm audit, Snyk)

### Compliance
- [ ] SBOM generated (CycloneDX or SPDX)
- [ ] Dependency audit pass
- [ ] Logging for audit trails
- [ ] Data protection (PII handling, GDPR/CCPA)

## RULES

- ALWAYS run OWASP checks before production
- ALWAYS use parameterized queries
- ALWAYS enforce HTTPS
- NEVER store secrets in code
- NEVER skip input validation
