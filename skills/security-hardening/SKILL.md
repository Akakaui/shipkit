---
title: Security Hardening
description: "OWASP Top 10 implementation, auth hardening, encryption at rest + transit, SBOM generation, compliance checks, audit logging."
triggers:
  - "security hardening"
  - "OWASP"
  - "auth security"
  - "encryption"
  - "compliance"
  - "audit log"
  - "SBOM"
  - "penetration test"
  - "vulnerability"
owner-agent: security
---

# Security Hardening

## OWASP Top 10 Quick Checks

| # | Category | Check | Fix |
|---|----------|-------|-----|
| 1 | Broken Access Control | Can user A access user B's data? | Row-level security, RBAC |
| 2 | Cryptographic Failures | Sensitive data sent in cleartext? | HTTPS only, encrypt PII |
| 3 | Injection | SQL/NoSQL/Command injection? | Parameterized queries, ORM |
| 4 | Insecure Design | Security considered in architecture? | Threat modeling at design |
| 5 | Security Misconfiguration | CORS open, debug on? | Lock down config per env |
| 6 | Vulnerable Components | Outdated deps? | Regular `npm audit`, Dependabot |
| 7 | Auth Failures | Weak password policy, no MFA? | bcrypt, MFA, lockout |
| 8 | Data Integrity Failures | No CSRF, no signature verification? | CSRF tokens, request signing |
| 9 | Logging Failures | No audit trail? | Structured logging, SIEM |
| 10 | SSRF | Server fetches user URLs? | Allow-list, URL validation |

## Authentication
- Password hashing: bcrypt (cost ≥ 12) or argon2id
- Session tokens: JWT with short expiry (15 min access, 7 day refresh)
- MFA: TOTP (speakeasy or similar)
- Account lockout: 5 attempts → 15 min lockout
- Password policy: min 8 chars, no common passwords

## Encryption
- **In transit:** TLS 1.3 (HTTPS only)
- **At rest:** AES-256 for DB columns with PII
- **In application:** Use `@peculiar/webcrypto` or `crypto.subtle`
- Key management: env vars → secret manager (Vault, AWS Secrets Manager)

## SBOM (Software Bill of Materials)
- Generate via `npm sbom` or `cyclonedx-bom`
- Include with every release
- Check against CVE database (OSV.dev)
- Monitor for new CVEs weekly

## Compliance Patterns
- **SOC 2:** Audit logging, access reviews, change management
- **GDPR:** Data deletion API, consent management, data portability
- **HIPAA:** Encryption, access controls, BAA with cloud provider
- **PCI-DSS:** Tokenization, scoping, quarterly scans

## Audit Logging
```yaml
log_events:
  - user.login, user.logout
  - user.role_change
  - resource.create, update, delete
  - permission.denied
  - configuration.change

log_format:
  timestamp: ISO 8601
  actor: user_id or system
  action: event name
  resource: resource_id + type
  result: success | failure
  ip: client IP
  user_agent: client UA
```
