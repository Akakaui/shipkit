# Auto-Detection Profiles

Used by the `@auto-detect` agent to classify projects and load appropriate skills.

## How It Works

1. `@auto-detect` reads project files (package.json, requirements.txt, README)
2. Classifies project type (saas, api, cli-tool, mobile, extension, game, fun-tool)
3. Estimates scale expectations (low, medium, high, enterprise)
4. Generates a `profile.json` with the appropriate skill set

## Profile Types

| Type | Scale | Skills | Intended For |
|------|-------|--------|-------------|
| saas | all | ALL 7 | SaaS products with auth, billing, multi-tenant |
| api | low/med | infra-networking, resilience-patterns, db-scale, prod-ops | Public APIs |
| api | high/enterprise | ALL 7 | High-scale public APIs |
| cli-tool | any | resilience-patterns, prod-ops | CLI tools, scripts |
| mobile | any | resilience-patterns, prod-ops (light) | Mobile apps |
| extension | any | prod-ops (light) | Browser extensions |
| game | any | prod-ops (light) | Games |
| fun-tool | any | production-hardening (light) | Side projects, experiments |
| enterprise | any | ALL 7 + extra patterns | Enterprise deployments |

## JSON Profile Format

```json
{
  "projectType": "saas",
  "scale": "medium",
  "stack": {
    "language": "TypeScript",
    "framework": "Next.js",
    "database": "PostgreSQL"
  },
  "skills": [
    "production-hardening",
    "infra-networking",
    "container-orch",
    "db-scale",
    "resilience-patterns",
    "security-hardening",
    "prod-ops"
  ],
  "recommendations": [
    "Add Sentry for error tracking",
    "Set up CI/CD with GitHub Actions",
    "Configure Cloudflare for CDN + DDoS protection"
  ]
}
```

## Override

Users can override auto-detection by creating a `shipkit.json` in the project root:

```json
{
  "profile": "saas",
  "scale": "enterprise",
  "skills": ["production-hardening", "infra-networking", "security-hardening"]
}
```
