---
title: Production Operations
description: "Monitoring, alerting, SLOs/SLIs, incident response, backup/restore procedures, cost optimization, capacity planning."
triggers:
  - "production ops"
  - "monitoring setup"
  - "alerts"
  - "SLO"
  - "incident response"
  - "backup"
  - "cost optimization"
  - "capacity planning"
  - "runbook"
owner-agent: ops-monitor
---

# Production Operations

## Monitoring Stack
```
Uptime:    Checkly / Better Uptime / Pingdom
Errors:    Sentry / Rollbar
Metrics:   Grafana + Prometheus / Datadog
Logs:      Grafana Loki / Datadog / Papertrail
APM:       Sentry Performance / Datadog APM / New Relic
```

## SLOs / SLIs

```yaml
sli:
  - name: Availability
    type: probe_success
    target: 99.9%
  - name: Latency (P95)
    type: http_request_duration_seconds
    target: < 500ms
  - name: Error Rate
    type: http_errors / http_requests
    target: < 1%
  - name: Deployment Frequency
    type: deploys_per_week
    target: >= 1/week
```

## Alert Severities

| Level | Response | Example |
|-------|----------|---------|
| **P0** | On-call, < 15 min | App down, data loss |
| **P1** | Within 1 hour | Latency spike, 5xx > 5% |
| **P2** | Within 8 hours | Slow DB query, deprecation warning |
| **P3** | Within 1 week | Low disk space, SSL expiring |

## Incident Response

1. **Detect** — Alert fires or user reports
2. **Acknowledge** — Who's handling it?
3. **Assess** — Severity? Impact? Root cause?
4. **Mitigate** — Rollback, feature flag, scale up
5. **Resolve** — Confirm fix
6. **Learn** — Postmortem (no-blame)

## Backup & Restore

```yaml
database:
  full_backup: daily at 02:00 UTC
  wal_archival: continuous
  retention: 30 days
  restore_test: quarterly
files:
  backups: hourly incremental
  retention: 7 days
  sync: offsite to S3/Backblaze
```

## Cost Optimization

- **Compute:** Right-size instances, use spot for batch
- **Storage:** Lifecycle policies, compress logs
- **Network:** Use CDN, cache aggressively
- **Database:** Connection pooling, archive old data
- **Monitoring:** Don't log everything, sample traces
- **Review:** Monthly cost review with per-service breakdown

## Capacity Planning

```
Metric          → Forecast model          → Action
CPU/Memory      → Linear trend             → Right-size or scale out
Storage growth  → Compound growth (30 day) → Add capacity + archive
Request volume  → Seasonal + trend         → Auto-scaling rules
Cost            → Per-unit tracking        → Budget alerts
```
