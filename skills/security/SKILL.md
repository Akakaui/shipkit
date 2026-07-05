# SECURITY — Security Checklist & Best Practices

## PURPOSE

Enforces security best practices across all projects.

## TRIGGERS

- "Check security"
- "Review security"
- "Harden application"

## NEVER

- Store secrets in code or Git
- Use console.log in production
- Skip input validation
- Trust client-side validation only
- Hard-code URLs or endpoints
- Deploy without testing auth flows
- Use deprecated dependencies
- Ignore TypeScript errors
- Skip error boundaries
- Leave TODO comments in production code

## ALWAYS

- Use environment variables for config
- Sanitize all user inputs
- Validate on backend even if frontend validates
- Use HTTPS only
- Implement rate limiting on APIs
- Hash passwords (never store plain text)
- Use prepared statements (prevent SQL injection)
- Implement CORS properly
- Add error tracking from day one
- Use TypeScript strict mode

## PRE-DEPLOYMENT CHECKLIST

- [ ] No secrets in code
- [ ] All inputs validated
- [ ] All auth checks in place
- [ ] All data encrypted
- [ ] Rate limiting implemented
- [ ] CSP configured
- [ ] Dependencies scanned
- [ ] No known vulnerabilities

## RULES

- ALWAYS check security first
- ALWAYS validate all inputs
- ALWAYS use HTTPS
- ALWAYS hash passwords
- ALWAYS implement rate limiting
- NEVER trust client-side validation
- NEVER skip auth checks
- NEVER store sensitive data in localStorage