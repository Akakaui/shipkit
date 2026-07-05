# PROD OPS — Production Operations & Reliability Engineering

## PURPOSE

Sub-skill of production-hardening. Covers SLO engineering, incident
management, on-call, postmortems, disaster recovery, failover,
multi-region, backups, chaos engineering, cost optimization,
serverless cold starts, monitoring alert design, and runbook authoring.

## TRIGGERS

- "Set up SLOs / error budgets"
- "Incident response / on-call setup"
- "Postmortem / blameless culture"
- "Disaster recovery / failover planning"
- "Multi-region deployment"
- "Backup strategy"
- "Chaos engineering"
- "Cloud cost optimization"
- "Cold start mitigation / Lambda optimization"
- "Prometheus alert rules / Grafana dashboards"
- "Runbook / playbook for on-call"
- "Production readiness review"
- Any request referencing: RTO, RPO, SLI, SEV1, PagerDuty, OpsGenie,
  P99 latency, burn rate, 3-2-1 backup, split-brain, pilot light,
  warm standby, spot instance, provisioned concurrency

---

## 1. SLOs / SLIs / ERROR BUDGETS

### Problem

Without SLOs, teams don't know what "good enough" means. Every
outage feels equally bad, and there's no data-driven way to decide
when to ship vs. when to stabilize.

### SLI Measurement Patterns

| SLI Type | Metric Source | Example Threshold |
|----------|--------------|-------------------|
| Availability | Request success rate (HTTP 2xx/4xx/5xx) | ≥ 99.9% over 30d rolling window |
| Latency (p99) | Request duration histogram | ≤ 500ms at p99 over 5m window |
| Latency (p95) | Request duration histogram | ≤ 200ms at p95 over 5m window |
| Durability | Object/record loss rate | ≥ 99.9999999% (11 nines) |
| Freshness | Time since last successful sync/index | ≤ 5m from wall clock |
| Throughput | Requests/minute or messages/minute | ≥ N (dimensioned to peak) |

### Runnable: Prometheus SLO Recording & Alert Rules

```yaml
# slo-rules.yml
# Recording rules: compute SLI burn rates from raw metrics
groups:
  - name: slo
    interval: 1m
    rules:
      # --- Availability SLO (99.9% over 30d) ---
      - record: slo:availability:total_requests_30d
        expr: sum(increase(http_requests_total[30d]))
      - record: slo:availability:good_requests_30d
        expr: sum(increase(http_requests_total{status!~"5.."}[30d]))
      - record: slo:availability:sli_30d
        expr: slo:availability:good_requests_30d / slo:availability:total_requests_30d

      # --- Latency SLO (p99 < 500ms) ---
      - record: job:http_request_duration_seconds:p99_5m
        expr: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))

      # --- Error budget (30d window, 99.9% target = 0.1% error budget) ---
      - record: slo:availability:error_budget_total_30d
        expr: sum(increase(http_requests_total[30d])) * 0.001
      - record: slo:availability:error_budget_consumed_30d
        expr: sum(increase(http_requests_total{status=~"5.."}[30d]))
      - record: slo:availability:error_budget_remaining_pct
        expr: max(0, (1 - slo:availability:error_budget_consumed_30d / slo:availability:error_budget_total_30d) * 100)
```

### Burn Rate Alerting (Multi-Window, Multi-Burn-Rate)

The industry-standard approach: alert when error budget is burning
fast enough to exhaust the budget within a short time.

```yaml
# burn-rate-alerts.yml
groups:
  - name: burn_rate
    interval: 1m
    rules:
      # Critical: 2% of 30d budget consumed in 1h (exhausts budget in ~2d)
      - alert: SLOErrorBudgetBurnCritical
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[1h])) /
          sum(rate(http_requests_total[1h])) > 0.02
          AND ON(service)
          sum(rate(http_requests_total{status=~"5.."}[5m])) /
          sum(rate(http_requests_total[5m])) > 0.02
        for: 2m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "SLO error budget burn rate is critical ({{ $value | humanizePercentage }})"
          description: |
            Error budget consumption rate is 2%+/hour on {{ $labels.service }}.
            At this rate, 30d budget exhausts in ~2 days.
            Action: page on-call immediately.

      # Warning: 5% of 30d budget consumed in 6h (exhausts budget in ~5d)
      - alert: SLOErrorBudgetBurnWarning
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[6h])) /
          sum(rate(http_requests_total[6h])) > 0.05
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "SLO error budget burn rate is elevated ({{ $value | humanizePercentage }})"
          description: |
            Error budget consumption at {{ $value | humanizePercentage }} over 6h.
            Action: investigate during business hours.
```

### Error Budget Policy

```
Error Budget Policy (example)
┌────────────────────┬───────────────┬─────────────────────────────┐
│ Budget Remaining   │ Release Risk  │ Action                      │
├────────────────────┼───────────────┼─────────────────────────────┤
│ > 50%              │ Aggressive    │ Deploy anytime               │
│ 20% – 50%          │ Normal        │ Standard release process     │
│ 5% – 20%           │ Conservative  │ Freeze risky features        │
│ < 5%               │ Frozen        │ Only critical fixes; all     │
│                    │               │ hands on reducing errors     │
└────────────────────┴───────────────┴─────────────────────────────┘
```

### Common Anti-Patterns

- **Too many SLOs** — pick 3-5 that map to user experience. Not every
  internal metric needs an SLO.
- **Tight targets on unreliables** — don't set 99.99% on a system
  before the engineering work to get there. Start at 99.9%.
- **Ignoring error budget** — if error budget is full but you still
  won't deploy, SLOs have no value.
- **Single-window alerts** — short windows false-alert; long windows
  detect too late. Multi-window multi-burn-rate solves both.

---

## 2. INCIDENT MANAGEMENT

### Severity Definitions

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|---------|
| SEV-1 | Complete service outage, data loss, security breach | ≤ 5 min | All HTTP 503, DB corrupt, PII leak |
| SEV-2 | Major feature degraded, partial outage, performance regression | ≤ 15 min | Checkout broken, p99 > 5s, search down |
| SEV-3 | Minor feature issue, cosmetic, non-critical | ≤ 1 business day | Wrong label on button, typo |
| SEV-4 | Question, documentation, low-priority task | ≤ 1 week | Feature request, log noise |
| SEV-5 | Internal tooling, infra housekeeping | Best effort | CI pipeline slow |

### Incident Response Workflow

```
DETECT → TRIAGE → MITIGATE → RESOLVE → FOLLOW-UP
   │        │         │          │           │
   │        │         │          │       Postmortem
   │        │     Rollback/    Verify     Action items
   │        │     Feature     Monitoring  Track to done
   │        │     Flag        Stable
   │        │     Scale-up
   │        │
   Alert    Severity    Who owns?
   fires    assigned    Need escalation?
            Paged       SRE / Dev / PM?
```

### Runnable: PagerDuty Incident Template (Terraform)

```hcl
# pagerduty_incident.tf
resource "pagerduty_service" "production" {
  name        = "Production API"
  description = "Production API service with auto-escalation"
  auto_resolve_timeout = 14400  # 4 hours
  acknowledgement_timeout = 600 # 10 min

  escalation_policy = pagerduty_escalation_policy.primary.id
}

resource "pagerduty_escalation_policy" "primary" {
  name      = "Primary On-Call Escalation"
  num_loops = 2

  rule {
    escalation_delay_in_minutes = 10
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.primary_oncall.id
    }
  }

  rule {
    escalation_delay_in_minutes = 15
    target {
      type = "schedule_reference"
      id   = pagerduty_schedule.secondary_oncall.id
    }
  }

  rule {
    escalation_delay_in_minutes = 5
    target {
      type = "user_reference"
      id   = pagerduty_user.engineering_manager.id
    }
  }
}

resource "pagerduty_schedule" "primary_oncall" {
  name      = "Primary On-Call (Week A/B)"
  time_zone = "UTC"

  # Bi-weekly rotation, Mon 09:00 handover
  layer {
    name                         = "Weekly Rotation"
    start                        = "2024-01-08T09:00:00Z"
    rotation_virtual_start       = "2024-01-08T09:00:00Z"
    rotation_turn_length_seconds = 604800  # 7 days
    users                        = [pagerduty_user.alice.id, pagerduty_user.bob.id]
  }
}
```

### Incident Command System (For SEV-1)

```
IC (Incident Commander)  — Owns the incident: communication, resource allocation, timeline
│
├── Scribe               — Takes notes, timestamps all actions, records decisions
├── Ops Lead             — Executes mitigation actions (restarts, rollbacks, scaling)
├── Comms Lead           — Updates status page, stakeholders, customer-facing comms
└── SME(s)               — Subject matter experts for deep diagnosis
```

### Communication Templates

**Initial notification (Slack / PagerDuty):**

```
🚨 SEV-1 | [Service Name] — [Brief Symptom]
• Time detected: [UTC]
• Impact: [% of users / specific features affected]
• Current status: [Investigating / Mitigating / Resolved]
• Lead: @name
• Channel: #incident-YYYYMMDD-XX
```

**Status page update:**

```
[INCIDENT] [Service Name] — [Brief Title]
Status: INVESTIGATING / MITIGATING / RESOLVED
Started: [UTC]
Impact: [Description of user-facing impact]
Actions: [What we're doing]
ETA: [If known]
```

### Common Anti-Patterns

- **No defined IC** — everyone jumps to fix, no one communicates.
  Always assign an Incident Commander first.
- **War room chaos** — too many people in the channel. Only those
  actively contributing stay; others lurk silently or leave.
- **Fixing before understanding root cause** — mitigation first,
  RCA after. Don't confuse "it's working again" with "we know why."
- **No status page updates** — customers assume the worst. Even
  "Investigating" is better than silence.

---

## 3. ON-CALL PRACTICES

### Rotation Scheduling

| Team Size | Rotation Length | Best For |
|-----------|----------------|----------|
| 2-3       | 3-4 days       | Alert-heavy, fast-paced |
| 4-6       | 1 week         | Balanced (most common) |
| 7+        | 2 weeks        | Light alert load |

### Follow-the-Sun Model

```
┌─────────┬─────────┬────────┐
│ US West │ US East │  EMEA  │
│ 9-5 PT  │ 9-5 ET  │ 9-5 UK │
├─────────┼─────────┼────────┤
│  Primary│  Shadow │  Off   │  (rotates every week)
└─────────┴─────────┴────────┘
```

### Handover Procedure

```
HANDOVER CHECKLIST ──────────────────────────────────
[ ] Review incident log from your shift
[ ] Note any ongoing investigations with context
[ ] Document known workarounds in progress
[ ] Confirm escalation paths are current
[ ] Verify PagerDuty schedule is accurate
[ ] Share unresolved tickets/threads
[ ] 5-min handoff call (mandatory)
────────────────────────────────────────────────────
```

### Pager Fatigue Prevention

- **Noisy alert budget** — each alert type: max 1 page in 24h.
  If it pages more, tune threshold or mute duplicates.
- **Follow-the-sun** — alerts route to awake engineers.
- **Alert silencing** — during known maintenance, suppress alerts.
- **Post-shift decompression** — the day after on-call has no
  meetings before noon. Burnout is a retention risk.
- **Shadow shifts** — new team members shadow 2 rotations before
  sole responsibility.

### Escalation Policy (Example)

```
Level 1: Primary on-call  (response ≤ 5 min SEV-1, ≤ 15 min SEV-2)
  ↑ 10 min no response
Level 2: Secondary on-call
  ↑ 15 min no response
Level 3: Engineering Manager
  ↑ 5 min no response (SEV-1) or 30 min (SEV-2)
Level 4: VP Engineering / CTO
```

### Common Anti-Patterns

- **24/7 on-call for small teams** — unsustainable. Trade off:
  run a lean on-call with follow-the-sun or accept SLAs that match
  business hours for non-critical systems.
- **No secondary** — primary is sick, in a meeting, or driving.
  Always have a secondary.
- **No handoff overlap** — handing over at midnight with no call
  means context is lost.
- **On-call during PTO** — engineers should not be on-call during
  planned time off. Plan rotations around it.

---

## 4. POSTMORTEMS

### Blameless Culture

A postmortem's goal is **prevent recurrence**, not assign blame.
"Root cause" is a systemic failure, not a person's mistake.

```
Good: "Deploy script lacked a canary verification step"
Bad:  "Alice forgot to check the canary before promoting"
```

### Postmortem Template

```markdown
# POSTMORTEM: [TITLE]

**Date:** YYYY-MM-DD
**Severity:** SEV-1 / SEV-2
**Duration:** XX hours YY minutes
**Impact:** X users affected, $Y revenue impact, Z data records
**Tag:** #incident-YYYYMMDD-XX

## Timeline (UTC)

| Time | Event |
|------|-------|
| HH:MM | Alert fired: [detail] |
| HH:MM | On-call acknowledged |
| HH:MM | Initial diagnosis: [what was thought] |
| HH:MM | Escalation to [team/person] |
| HH:MM | Mitigation action taken: [what] |
| HH:MM | Service restored |
| HH:MM | Monitoring confirmed stable |

## Root Cause Analysis (5 Whys)

1. Why was the service down? → Deploy v2.3.1 had a memory leak
2. Why did the memory leak pass tests? → Integration tests allocate < 100MB
3. Why didn't canary catch it? → Canary ran for only 2 minutes
4. Why only 2 minutes? → Deploy pipeline default timeout
5. Why hasn't this been tuned? → No documented sizing guidance for canaries

**Root Cause:** Pipeline default timeout too short for memory leak detection.

## Contributing Factors

- No integration test with realistic data volume
- Canary duration not reviewed after service migrated to larger instances
- Memory alert threshold too high (90%) — alert never fired

## Action Items

| # | Action | Owner | Tracked In | Due |
|---|--------|-------|------------|-----|
| 1 | Set canary min duration to 10 minutes | @devops | JIRA-123 | YYYY-MM-DD |
| 2 | Add memory leak detection to CI pipeline (valgrind / heap profiler) | @backend | JIRA-124 | YYYY-MM-DD+7 |
| 3 | Reduce memory alert threshold to 75% | @sre | JIRA-125 | YYYY-MM-DD+2 |
| 4 | Add realistic data volume integration tests | @qa | JIRA-126 | YYYY-MM-DD+14 |

## Lessons Learned

### What went well
- Fast detection via p99 latency spike alert
- Clear escalation path to DB team

### What went wrong
- Memory growth wasn't visible in standard dashboards
- Canary was too short to reproduce the issue

### Where we got lucky
- Incident happened during business hours
- No data loss
```

### Action Item Tracking

- Every postmortem produces tracked, dated, owned action items.
- Monthly postmortem review: are action items closed?
- If same root cause appears in 2+ postmortems, it's a systemic
  issue requiring a project, not a ticket.

### Common Anti-Patterns

- **No postmortem for SEV-2+** — every significant incident needs
  one. If it paged, write it up.
- **Blaming individuals** — "Bob fat-fingered the config." Instead:
  "Config change required no peer review." The question is always
  systemic: *why could Bob make that change without review?*
- **Action items never closed** — postmortems without follow-through
  are theater. Track them like bugs.
- **Too slow** — postmortem within 48h of resolution. Fresh
  memories are critical for accurate timeline.

---

## 5. DISASTER RECOVERY

### RTO and RPO

```
RTO (Recovery Time Objective): How fast must we be back up?
  └── Determines failover strategy
RPO (Recovery Point Objective): How much data can we lose?
  └── Determines backup frequency
```

| RTO | RPO | Appropriate Strategy | Monthly Cost (est.) |
|-----|-----|---------------------|---------------------|
| < 1 min | < 1 sec | Active-Active multi-region | $$$$$ |
| < 15 min | < 5 min | Warm standby + streaming replication | $$$ |
| < 1 hour | < 15 min | Pilot light + async replication | $$ |
| < 4 hours | < 1 hour | Backup/restore from automated backups | $ |
| < 24 hours | < 24 hours | Cold backup from S3/Blob storage | $ |

### DR Strategies

#### Backup / Restore (RTO: hours, RPO: hours)
- Periodic backups to object storage
- Restore process: provision new infra, restore data, switch DNS
- Cheapest strategy, highest RTO

#### Pilot Light (RTO: 15-45 min, RPO: < 15 min)
- Core data services always running (DB replicates)
- App servers scaled to 0, can scale up on failover
- DNS or load balancer switches traffic

#### Warm Standby (RTO: 5-15 min, RPO: < 5 min)
- Full infra running in secondary region at reduced capacity
- Streaming replication (e.g., PostgreSQL streaming, Kafka MirrorMaker)
- Can scale up on failover; takes traffic immediately

#### Active-Active (RTO: < 1 min, RPO: near-zero)
- Both regions serve traffic simultaneously
- Global load balancer routes by latency
- Data replication with conflict resolution
- Most expensive, highest complexity

### Runnable: DR Test Schedule

```yaml
# dr-test-schedule.yml
quarterly:
  trigger: "First Monday of quarter"
  type: "Tabletop exercise"  # Walk through runbook, no infra changes
  participants: [SRE, engineering manager, product owner]
  duration: 1 hour
  scenarios:
    - "Primary region completely unavailable"
    - "Database corruption detected"
    - "Slow-rolling data corruption (stale reads)"

semi_annual:
  trigger: "Second month of quarter"
  type: "Failover drill"
  scope: "Non-production environment"
  process:
    1. "Shut down primary region services"
    2. "Execute failover runbook"
    3. "Verify functionality in DR region"
    4. "Fail back to primary"
    5. "Document gaps and fix"

annual:
  trigger: "Q4"
  type: "Production failover"
  scope: "Read-only traffic first, gradual full failover"
  preconditions:
    - "All quarterly gaps addressed"
    - "DR runbook reviewed and updated"
```

### Common Anti-Patterns

- **Never tested DR** — a DR plan that hasn't been tested is a
  fairy tale. Schedule drills.
- **N+1 dependencies** — backup region depends on the same DB
  cluster as primary. A shared dependency negates DR.
- **RPO = 0 but no sync validation** — async replication can mask
  lag. Monitor replication lag with alerts.
- **No DR for the DR** — if failover requires manual DNS changes
  and the DNS admin is on vacation, you have a single point of
  failure.

---

## 6. FAILOVER

### Active-Passive vs Active-Active Failover

| Aspect | Active-Passive | Active-Active |
|--------|---------------|---------------|
| Traffic | All to primary; standby idle or minimal | Both regions serve traffic |
| RTO | Minutes (DNS TTL + health check) | Near-zero (no switch needed) |
| Cost | ~1.5x (standby at reduced capacity) | ~2x (full capacity in both) |
| Complexity | Low-medium | High (data consistency, conflict resolution) |
| Data replication | Async or streaming | Bidirectional / CRDT / app-level |
| Typical use | RTO < 15 min acceptable | RTO < 1 min required |

### Automated vs Manual Failover

**Automated failover** when:
- Health checks fail in both the load balancer AND external
  monitoring (e.g., external probe from different region)
- 3 consecutive failures across multiple AZs
- No manual override pending

**Manual failover** when:
- Planned maintenance (deploy, upgrade)
- Partial degradation (better to ride out than switch)
- Split-brain risk (one region may still be partially alive)

### Runnable: AWS Route 53 Failover (Terraform)

```hcl
# route53-failover.tf
resource "aws_route53_health_check" "primary_api" {
  fqdn              = "api.primary.example.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/healthz"
  failure_threshold = 3
  request_interval  = 10         # checks every 10 seconds
  measure_latency   = true

  tags = { Name = "primary-api-health" }
}

resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"

  set_identifier = "primary"
  failover_routing_policy {
    type = "PRIMARY"
  }
  alias {
    name                   = aws_lb.primary.dns_name
    zone_id                = aws_lb.primary.zone_id
    evaluate_target_health = true
  }
  health_check_id = aws_route53_health_check.primary_api.id
}

resource "aws_route53_record" "api_secondary" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"

  set_identifier = "secondary"
  failover_routing_policy {
    type = "SECONDARY"
  }
  alias {
    name                   = aws_lb.secondary.dns_name
    zone_id                = aws_lb.secondary.zone_id
    evaluate_target_health = true
  }
  # No health check on secondary — it's the fallback
}
```

### Split-Brain Prevention

**What is split-brain?** Both regions believe they are primary
and begin accepting writes independently, creating divergent data.

**Prevention mechanisms:**

```
┌────────────────────────────┬────────────────────────────────────┐
│ Mechanism                  │ How it works                       │
├────────────────────────────┼────────────────────────────────────┤
│ Lease / fencing            │ Only one region holds a lease;     │
│                            │ others must wait for expiry        │
│ Quorum-based consensus     │ etcd/ZooKeeper majority vote;      │
│                            │ < 1/2 nodes = no writes            │
│ STONITH                    │ "Shoot The Other Node In The Head" │
│                            │ Force-kill primary before failover │
│ Health + external check    │ Don't trust self-report; use       │
│                            │ 3rd-party health endpoint in       │
│                            │ separate availability zone         │
└────────────────────────────┴────────────────────────────────────┘
```

**Runnable split-brain guard logic (pseudo):**

```python
# Before promoting to primary:
def should_promote_to_primary():
    # 1. Check if previous primary is truly dead
    primary_healthy = external_health_check("primary-api.example.com")

    if primary_healthy:
        # Don't promote — primary is alive, this would cause split-brain
        raise FailoverAborted("Primary still healthy; split-brain risk")

    # 2. Acquire a distributed lock (etcd / DynamoDB lock)
    lock = acquire_lock("failover-lock", ttl=60)
    if not lock:
        raise FailoverAborted("Another region acquired the lock first")

    # 3. Re-verify primary health (it may have recovered in the meantime)
    if external_health_check("primary-api.example.com"):
        release_lock("failover-lock")
        raise FailoverAborted("Primary recovered before lock acquisition")

    return True
```

### Common Anti-Patterns

- **DNS-only failover without health checks** — Route 53 failover
  routing requires health checks. Without them, it's just round-robin.
- **Same-AZ dependencies** — load balancer, DB, cache all in one AZ
  means an AZ outage takes everything down.
- **Failover test never run** — half the failover scripts have
  stale credentials or missing IAM permissions. Test quarterly.
- **Auto-failover without circuit breaker** — if failover triggers
  on a false positive (e.g., network blip), you've caused an outage.
  Require multi-region health probes + sustained failure.

---

## 7. MULTI-REGION DEPLOYMENTS

### Architecture: Active-Active vs Active-Passive

```
ACTIVE-ACTIVE                         ACTIVE-PASSIVE
┌─────────┐    ┌─────────┐           ┌─────────┐    ┌─────────┐
│ us-east │    │ eu-west │           │ us-east │    │ eu-west │
│ Active  │←──→│ Active  │           │ Active  │    │ Standby │
│ Serving │    │ Serving │           │ Serving │    │ (cold)  │
│ Traffic │    │ Traffic │           │ Traffic │    │         │
└────┬────┘    └────┬────┘           └────┬────┘    └────┬────┘
     │              │                     │              │
     │  Replicate   │                     │  Replicate   │
     │  (async)     │                     │  (async)     │
     └──────┬───────┘                     └──────┬───────┘
            │                                   │
       ┌────┴────┐                          ┌────┴────┐
       │  Global  │                          │  Global  │
       │   LB     │                          │   LB     │
       └────┬────┘                          └────┬────┘
            │                                   │
         Users                                Users
```

### Global Load Balancing (GLB) Options

| Service | Routing Method | Failover | Cost |
|---------|---------------|----------|------|
| AWS CloudFront + Route 53 | Latency-based, Geo-proximity | Automated health checks | $$ |
| GCP Cloud Load Balancing | Anycast, Nearest-region | Automatic | $$ |
| Cloudflare | Anycast + Smart Routing | Instant (global network) | $$ |
| F5 / NGINX + DNS | Custom policy | Configurable | $$$ |

### Runnable: Global Load Balancer (GCP Terraform)

```hcl
# glb-multi-region.tf
resource "google_compute_url_map" "global_lb" {
  name            = "global-lb"
  default_service = google_compute_backend_service.us_central.id
}

resource "google_compute_backend_service" "us_central" {
  name          = "us-central-backend"
  health_checks = [google_compute_health_check.api.id]
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_instance_group_manager.us_central.instance_group
    balancing_mode = "RATE"
    max_rate_per_instance = 100
  }
}

resource "google_compute_backend_service" "europe_west" {
  name          = "europe-west-backend"
  health_checks = [google_compute_health_check.api.id]
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_instance_group_manager.europe_west.instance_group
    balancing_mode = "RATE"
    max_rate_per_instance = 100
  }
}

resource "google_compute_health_check" "api" {
  name = "api-health"
  http_health_check {
    port         = 8080
    request_path = "/healthz"
  }
  check_interval_sec  = 5
  timeout_sec         = 3
  healthy_threshold   = 2
  unhealthy_threshold = 3
}
```

### Data Replication Across Regions

| Data Store | Replication Strategy | RPO | Conflict Resolution |
|-----------|---------------------|-----|-------------------|
| PostgreSQL | Streaming replication → cascading to DR region | < 1 sec | N/A (single-writer) |
| CockroachDB | Active-Active (Raft consensus, multi-region) | Near-zero | Automatic (CRDT) |
| DynamoDB Global Tables | Active-Active (last-writer-wins) | < 1 sec | LWW / custom |
| Kafka (MirrorMaker / Cluster Linking) | Async topic replication | < 5 sec | Application-side |
| Redis (CRDT-based: Redis Enterprise / DiceDB) | Active-Active | < 1 sec | CRDT |
| S3 Cross-Region Replication | Object-level async | < 15 min | Last write wins |

### Latency-Based Routing

```hcl
# route53-latency-routing.tf
resource "aws_route53_record" "api_latency" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"
  set_identifier = "us-east"
  latency_routing_policy {
    region = "us-east-1"
  }
  alias {
    name                   = aws_lb.us_east.dns_name
    zone_id                = aws_lb.us_east.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api_latency_eu" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "api.example.com"
  type    = "A"
  set_identifier = "eu-west"
  latency_routing_policy {
    region = "eu-west-1"
  }
  alias {
    name                   = aws_lb.eu_west.dns_name
    zone_id                = aws_lb.eu_west.zone_id
    evaluate_target_health = true
  }
}
```

### Common Anti-Patterns

- **Assuming cross-region replication has zero lag** — it doesn't.
  Monitor replication lag and set alerts.
- **Writing to multiple regions without conflict resolution** —
  last-writer-wins may lose data. Use CRDTs or app-level resolution.
- **Cold standby is not a DR strategy if RTO < 1 hour** — provisioning
  full infra from scratch takes hours. Warm standby at minimum.
- **Ignoring regulatory data residency** — EU user data must stay in EU.
  Geo-routing must respect data sovereignty.

---

## 8. BACKUPS

### The 3-2-1 Rule

```
3 ── Copies of your data
2 ── Different media types (e.g., SSD + object storage)
1 ── Off-site / different region
```

### Automated Backup Scheduling

```hcl
# backup-policy.tf (AWS Backup)
resource "aws_backup_plan" "production" {
  name = "production-backup-plan"

  rule {
    rule_name         = "daily-backup"
    target_vault_name = aws_backup_vault.primary.name
    schedule          = "cron(0 4 * * ? *)"  # Daily 04:00 UTC
    start_window      = 60   # minutes
    completion_window = 120  # minutes

    lifecycle {
      cold_storage_after = 30   # days
      delete_after       = 365  # days (1 year retention)
    }

    copy_action {
      destination_vault_arn = aws_backup_vault.dr.arn
      lifecycle {
        cold_storage_after = 30
        delete_after       = 365
      }
    }
  }

  rule {
    rule_name         = "hourly-transaction-log"
    target_vault_name = aws_backup_vault.primary.name
    schedule          = "cron(0 * * * ? *)"  # Every hour
    start_window      = 15
    completion_window = 30
    lifecycle {
      delete_after = 7  # 7 day log retention
    }
    enable_continuous_backup = true
    recovery_point_tags = {
      Type = "transaction-log"
    }
  }
}

resource "aws_backup_selection" "production_resources" {
  name         = "production-resources"
  plan_id      = aws_backup_plan.production.id
  resources = [
    aws_rds_cluster.production.arn,
    aws_efs_file_system.data.arn,
    aws_dynamodb_table.users.arn,
  ]
  # Or use tags: selection_tag { type = "STRING_EQUALS", key = "Backup", value = "daily" }
}
```

### Backup Verification

```yaml
# restore-drill.yml
monthly:
  - name: "Restore RDS snapshot to staging"
    command: "aws rds restore-db-instance-from-db-snapshot"
    verify: "Run integration test suite against restored instance"
    cleanup: "Delete restored instance after verification"

  - name: "Restore EBS volume"
    command: "aws ec2 create-volume --snapshot <snapshot-id>"
    verify: "Mount and validate file integrity (md5sum of known files)"
    cleanup: "Delete volume after verification"

quarterly:
  - name: "Full DR restore from backups"
    verify:
      - "Provision new environment from latest backups"
      - "All services healthy"
      - "Data integrity verified"
      - "Performance meets SLOs"
    cleanup: "Teardown DR environment"
```

### Encryption

```hcl
# backup-encryption.tf
resource "aws_backup_vault" "primary" {
  name        = "production-backup-vault"
  kms_key_arn = aws_kms_key.backup.arn
}

resource "aws_kms_key" "backup" {
  description             = "Backup encryption key"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
        ]
        Resource = "*"
      }
    ]
  })
}
```

### Retention Policy

```
┌────────────┬──────────┬───────────────┬────────────────┐
│ Data Type  │ Retention│ Frequency     │ Example        │
├────────────┼──────────┼───────────────┼────────────────┤
│ Transaction│ 7 days   │ Continuous /  │ WAL archive,   │
│ logs       │          │ Hourly        │ binlog         │
│ Daily      │ 30 days  │ Daily         │ Full DB backup │
│ snapshots  │          │               │                │
│ Weekly     │ 90 days  │ Weekly        │ Full + logs    │
│ Monthly    │ 1 year   │ Monthly       │ Month-end      │
│ Annual     │ 7 years  │ Yearly        │ Compliance     │
│            │          │               │ (HIPAA, SOC2)  │
└────────────┴──────────┴───────────────┴────────────────┘
```

### Common Anti-Patterns

- **No restore testing** — backups are worthless if they can't be
  restored. Test monthly. A backup that fails to restore is just an
  expensive paperweight.
- **Same-region backups** — if the region goes down, so do your
  backups. Replicate to a second region.
- **One retention policy fits all** — transaction logs need days,
  compliance data needs years. Separate policies by data class.
- **Backup alerts not configured** — a failing backup that nobody
  notices for weeks means the RPO was exceeded silently.
- **No encryption** — backups contain PII. Encrypt at rest and
  in transit.

---

## 9. CHAOS ENGINEERING

### Principles

Chaos engineering is not random chaos. It's **experimental testing**
of system resilience through controlled, observable experiments.

```
1. Define steady-state hypothesis  ── "System will still serve 99.9%
                                      of requests correctly while
                                      us-east-1 is unreachable"
2. Design experiment               ── What failure? What blast radius?
                                      What measurement?
3. Minimize blast radius           ── Start in staging. Limit to 1%
                                      of production users.
4. Run experiment                  ── Automate or manual with
                                      rollback ready.
5. Observe vs hypothesis           ── Did it hold? If not, you found
                                      a resilience gap.
6. Fix and re-test                 ── Close the gap.
```

### Steady-State Hypothesis Template

```
When [failure scenario] happens,
[service] will continue to [expected behavior]
as measured by [metric] remaining within [threshold].

Example:
"When us-east-1 API latency spikes to 2s,
the checkout service will continue to complete
>99% of requests within 5s as measured by
http_request_duration_seconds{p95} < 5s."
```

### Runnable: Chaos Experiment Config (LitmusChaos)

```yaml
# chaos-experiment-pod-delete.yaml
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: pod-delete-api
  namespace: production
spec:
  engineState: "active"
  annotationCheck: "false"
  appinfo:
    appns: "production"
    applabel: "app=api-server"
    appkind: "deployment"
  chaosServiceAccount: litmus-admin
  monitoring: true
  # Blast radius: only 1 pod at a time
  experiments:
    - name: pod-delete
      spec:
        components:
          env:
            - name: TOTAL_CHAOS_DURATION
              value: "60"        # seconds
            - name: RAMP_TIME
              value: "10"
            - name: CHAOS_INTERVAL
              value: "10"        # 10s between deletes
            - name: FORCE
              value: "true"
            - name: TARGET_PODS
              value: "1"         # blast radius: 1 pod
        probes:
          - name: "check-api-health"
            type: "httpProbe"
            httpProbe/inputs:
              url: "http://api:8080/healthz"
              expectedResponseCode: "200"
            mode: "Continuous"
            runProperties:
              probeTimeout: 5
              interval: 2
```

### Chaos Engineering Tools

| Tool | Type | Best For |
|------|------|----------|
| Chaos Monkey (Spinnaker) | Instance termination | Testing auto-recovery, instance replacement |
| Gremlin | SaaS + agent | Network (latency, loss, blackhole), DNS blackhole, CPU/memory stress, IO |
| LitmusChaos | K8s-native | Pod delete, container kill, node drain, network chaos, stress |
| AWS FIS (Fault Injection Simulator) | AWS-managed | EC2 stop, RDS failover, AZ impairment, EBS pause |
| Chaos Mesh | K8s-native | Network partition, clock skew, kernel fault, DNS error |

### Production Blast Radius Rules

```
┌─────────────────────────────────────────────────────────┐
│ BLAST RADIUS POLICY                                     │
├──────────────┬──────────────────────────────────────────┤
│ Staging      │ Any failure — no limit                   │
│ Canary (1%)  │ Pod/instance failures only               │
│ Production   │ Max 1 instance/pod at a time              │
│              │ Never target DB primary                   │
│              │ Never target auth service                 │
│              │ Must have automated rollback              │
│              │ Business hours only                       │
└──────────────┴──────────────────────────────────────────┘
```

### Common Anti-Patterns

- **Chaos without hypothesis** — running random failures without
  knowing what you expect is vandalism, not engineering.
- **Too much, too soon** — start with pod deletion. Don't jump to
  region failover on day one.
- **No automated rollback** — every experiment must have a "stop
  button" that restores the system to steady state.
- **Chaos in prod without SRE oversight** — experiments need
  a human with kill-switch access.
- **Treating it as a one-time event** — chaos engineering is a
  continuous practice. Run experiments as part of the release
  pipeline.

---

## 10. COST OPTIMIZATION

### Cloud Cost Monitoring

```yaml
# cost-monitoring-prometheus.yml
# Export AWS billing data via cloudwatch-exporter
groups:
  - name: cost_alerts
    rules:
      - alert: DailyCostSpike
        expr: |
          sum(aws_estimated_charges{service!="AWS Support"}) by (service)
          / scalar(sum(aws_estimated_charges{service!="AWS Support"} offset 7d))
          > 2.0
        for: 2h
        labels:
          severity: warning
        annotations:
          summary: "Daily cost spike: {{ $labels.service }} is 2x+ vs last week"
```

### Right-Sizing Strategy

```yaml
# right-sizing-policy.yml
rules:
  # CPU: if avg utilization < 20% for 7 days → downsize
  - condition: "avg_over_time(node_cpu_utilization[7d]) < 0.20"
    action: "Reduce instance size by 50% (e.g., m5.large → m5.xlarge → m5.large)"
    cooldown: 14 days

  # Memory: if max utilization < 40% for 14 days → downsize
  - condition: "max_over_time(node_memory_utilization[14d]) < 0.40"
    action: "Reduce memory allocation / instance size"
    cooldown: 14 days

  # Under-utilized for 30 days → evaluate if instance should exist
  - condition: "avg_over_time(node_cpu_utilization[30d]) < 0.05"
    action: "Flag for review — candidate for deletion or consolidation"
```

### Spot Instances

```hcl
# spot-instance-config.tf
resource "aws_spot_fleet_request" "batch_workers" {
  spot_price      = "0.10"  # max bid
  target_capacity = 10
  allocation_strategy = "capacityOptimized"

  launch_specification {
    instance_type     = "c5.2xlarge"
    ami               = data.aws_ami.ubuntu.id
    subnet_id         = aws_subnet.private.id
    iam_instance_profile = aws_iam_instance_profile.worker.name

    # Spot-only: handle interruptions
    user_data = base64encode(<<-EOF
      #!/bin/bash
      # Handle spot termination notice (2 min warning)
      curl -s http://169.254.169.254/latest/meta-data/spot/termination-time
      # If returns a time, we're being terminated
      trap 'echo "Spot termination: draining jobs..." && sleep 5 && exit 0' SIGTERM
    EOF
    )
  }

  # Use mixed instances for resiliency
  launch_specification {
    instance_type = "c5a.2xlarge"
    ami           = data.aws_ami.ubuntu.id
    subnet_id     = aws_subnet.private.id
    iam_instance_profile = aws_iam_instance_profile.worker.name
  }
}
```

### Reserved Capacity vs On-Demand

```
WORKLOAD PATTERN → COST-OPTIMAL MIX
┌────────────────────┬──────────────┬────────────────┐
│ Workload Type      │ Savings      │ Recommended    │
│                    │ (vs On-Demand)│ Mix            │
├────────────────────┼──────────────┼────────────────┤
│ Steady state       │ 60-72%       │ 3yr Reserved    │
│ (DB, cache,        │              │ (Convertible)  │
│  core API)         │              │               │
│ Predictable batch  │ 60-90%       │ Spot +         │
│ (CI/CD, ETL, data) │              │ Reserved for   │
│                    │              │ minimum floor  │
│ Variable / new     │ 0%           │ On-Demand +    │
│ (testing, staging) │              │ Spot           │
│ Burstable          │ 30-50%       │ Compute Savings│
│ (seasonal spikes)  │              │ Plan + Spot    │
└────────────────────┴──────────────┴────────────────┘
```

### Storage Tiering

```yaml
# storage-lifecycle-policy.yml
rules:
  - name: "S3 lifecycle — logs"
    prefix: "/logs/"
    transitions:
      - after: 30 days
        to: STANDARD_IA         # 50% cheaper
      - after: 90 days
        to: GLACIER_INSTANT_RETRIEVAL  # 70% cheaper
      - after: 365 days
        to: DEEP_ARCHIVE        # 95% cheaper
    expiration:
      after: 2555 days          # 7 years

  - name: "EBS snapshot cleanup"
    frequency: "weekly"
    delete_older_than: 90 days
    exclude:
      - "most-recent-2-snapshots"
      - "tag:Retain=true"
```

### Idle Resource Detection

```yaml
# idle-resource-alerts.yml
groups:
  - name: idle_resources
    rules:
      # Unattached EBS volumes
      - alert: UnattachedVolume
        expr: aws_ebs_volume_info{status="available"}
        for: 7d
        labels:
          severity: warning
        annotations:
          summary: "Unattached volume {{ $labels.volume_id }} ({{ $labels.size }}GB)"

      # Idle load balancers (no traffic for 7 days)
      - alert: IdleLoadBalancer
        expr: rate(aws_lb_request_count_total[1h]) == 0
        for: 7d
        labels:
          severity: info
        annotations:
          summary: "Load balancer {{ $labels.name }} has zero traffic"

      # Orphaned elastic IPs
      - alert: UnassociatedElasticIP
        expr: aws_eip_info{association_id=""}
        for: 1d
        labels:
          severity: info
        annotations:
          summary: "Elastic IP {{ $labels.public_ip }} not associated"
```

### Cost Optimization: Quick Wins (highest ROI first)

1. **Right-size over-provisioned instances** — 30-50% savings
2. **Use Spot for stateless workloads** — 60-90% savings
3. **Delete unattached resources** — EBS, EIP, Load Balancers
4. **S3 lifecycle policies** — auto-tier old data to cold storage
5. **Reserved capacity for steady-state** — 60-72% savings
6. **Eliminate idle dev/staging outside business hours** —
   auto-stop dev environments on nights/weekends
7. **Right-size RDS instances** — most commonly over-provisioned 2x
8. **Compress logs / data** — before moving to cold storage
9. **Use Graviton / ARM instances** — 20-40% cheaper for same perf
10. **Check data transfer costs** — inter-region, NAT gateway, egress

### Common Anti-Patterns

- **Optimizing for cost at the expense of reliability** —
  all-spot with no fallback = service disappears when spot
  capacity is reclaimed. Mix spot + on-demand + reserved.
- **Forgetting to downsize after traffic drops** — a post-launch
  spike ends, but the instances stay scaled up. Automate scale-down.
- **Not tagging resources** — impossible to track cost per service
  without tags. Enforce tag policies.
- **Storage snapshot hoarding** — daily snapshots from 3 years ago
  cost more than the running instances. Delete old snapshots.

---

## 11. COLD STARTS & SERVERLESS LIMITS

### Lambda / Cloud Functions Cold Start

**What causes cold starts?**
- First invocation after a period of inactivity (~5-15 min per
  concurrent instance)
- Deployment of new function version (all instances recycled)
- Scaling up to a new concurrent execution environment
- VPC-enabled functions add ENI attachment latency (adds 2-10s)

### Cold Start Benchmarks

```
Runtime        | Cold Start (no VPC) | Cold Start (VPC) | Warm
───────────────┼─────────────────────┼──────────────────┼─────
Node.js 20.x   | ~150-300ms         | ~1-3s            | ~2-5ms
Python 3.12    | ~200-400ms         | ~1-3s            | ~2-5ms
Java 21        | ~800-2000ms        | ~2-5s            | ~3-10ms
.NET 8         | ~500-1000ms        | ~1.5-4s          | ~3-10ms
Go 1.x         | ~100-200ms         | ~800ms-2s        | ~1-3ms
Ruby 3.2       | ~300-600ms         | ~1-3s            | ~3-8ms

(Config: 1024MB, ZIP deployment. Container images add 30-50% to cold start.)
```

### Runnable: Provisioned Concurrency (Terraform)

```hcl
# lambda-provisioned-concurrency.tf
resource "aws_lambda_function" "api" {
  function_name = "production-api"
  runtime       = "nodejs20.x"
  handler       = "index.handler"
  role          = aws_iam_role.lambda_exec.arn
  filename      = "lambda.zip"
  timeout       = 30
  memory_size   = 1024

  # Minimize deployment package size
  # Keep dependencies lean: use Lambda Layers for shared libs
  layers = [aws_lambda_layer_version.shared_deps.arn]

  # VPC config — only if needed; adds latency
  # Prefer AWS SDK with no VPC when possible
  # vpc_config {
  #   subnet_ids         = aws_subnet.private[*].id
  #   security_group_ids = [aws_security_group.lambda.id]
  # }
}

# Solves cold starts: keep N instances warm
resource "aws_lambda_provisioned_concurrency_config" "api" {
  function_name                     = aws_lambda_function.api.function_name
  qualifier                         = "production"
  provisioned_concurrent_executions = 10  # keep 10 instances hot
}

# Auto-scaling for provisioned concurrency (based on utilization)
resource "aws_appautoscaling_target" "lambda_scaling" {
  max_capacity       = 50
  min_capacity       = 10
  resource_id        = "function:${aws_lambda_function.api.function_name}:production"
  scalable_dimension = "lambda:function:ProvisionedConcurrency"
  service_namespace  = "lambda"
}

resource "aws_appautoscaling_policy" "lambda_scaling_policy" {
  name               = "ScaleProvisionedConcurrency"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.lambda_scaling.resource_id
  scalable_dimension = aws_appautoscaling_target.lambda_scaling.scalable_dimension
  service_namespace  = aws_appautoscaling_target.lambda_scaling.service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 0.7  # scale when 70% of provisioned concurrency is used
    predefined_metric_specification {
      predefined_metric_type = "LambdaProvisionedConcurrencyUtilization"
    }
  }
}
```

### Cold Start Mitigation Strategies

| Strategy | Complexity | Cost | Effectiveness |
|----------|-----------|------|---------------|
| **Increase memory** (more CPU → faster init) | None | Higher per-invocation | 20-40% faster |
| **Provisioned Concurrency** | Medium | Always running cost | Eliminates cold starts |
| **Warmers** (scheduled pings) | Low | Minimal (if tuned) | Reduces but doesn't eliminate |
| **SnapStart (Java/Python)** | Low | None | ~90% reduction |
| **X86 → Graviton ARM** | Low | Cheaper | ~20% faster init |
| **Reduce deployment size** | Medium | None | 30-60% faster |
| **AWS Lambda Runtime API** (custom SDK init) | High | None | Variable |
| **Reserve concurrency** | Low | None (min concurrency) | Ensures capacity |

### Runnable: Lambda Warmer (Scheduled)

```typescript
// warmer.ts — deploy as a separate scheduled Lambda
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const TARGETS = [
  { name: "production-api", aliases: ["production", "v2"] },
  { name: "production-auth", qualifier: "production" },
];

async function warmFunction(name: string, qualifier: string) {
  const client = new LambdaClient({ region: process.env.AWS_REGION });
  const cmd = new InvokeCommand({
    FunctionName: name,
    Qualifier: qualifier,
    InvocationType: "RequestResponse",  // needs to actually run
    Payload: Buffer.from(JSON.stringify({ source: "warmer", warmup: true })),
  });

  // Check if it was a cold start:
  const result = await client.send(cmd);
  // X-Lambda-Invoked-Function-ARN includes $LATEST vs provisioned
  console.log(`${name}:${qualifier} → ${result.StatusCode}`);
}

// EventBridge schedule: every 4 minutes
export async function handler(event: any) {
  await Promise.all(
    TARGETS.flatMap(t =>
      t.aliases?.map(a => warmFunction(t.name, a)) ?? [warmFunction(t.name, t.qualifier)]
    )
  );
}
```

### Lambda Limits & Optimizations

```
┌────────────────────────────┬──────────────────┬──────────────────────┐
│ Limit                      │ Hard Cap         │ Recommended          │
├────────────────────────────┼──────────────────┼──────────────────────┤
│ Memory                     │ 128 MB – 10,240 MB│ Start at 1024 MB     │
│                           │                  │ (proportional CPU)   │
│ Function timeout           │ 15 minutes       │ Keep < 30s for APIs  │
│                           │                  │ > 30s → Step Functions│
│ Deployment package (ZIP)   │ 250 MB (unzipped)│ Target < 50 MB       │
│                           │                  │ Use Layers for shared │
│ /tmp storage               │ 10,240 MB        │ Use /tmp for caching │
│                           │                  │ Not for persistence  │
│ Concurrent executions      │ 1,000 (default)  │ Reserve for critical │
│                           │ (can raise)       │ functions; use FIFO  │
│                           │                  │ with SQS otherwise   │
│ Payload size (sync)        │ 6 MB             │ Use S3 for > 6MB     │
│ Payload size (async)       │ 256 KB           │ Use S3 + presigned   │
│ Cold start (Node, 1024MB)  │ N/A              │ Target < 200ms       │
│                           │                  │ (no VPC)             │
└────────────────────────────┴──────────────────┴──────────────────────┘
```

### Memory & Timeout Optimization

```python
# memory_optimizer.py — find optimal memory for your Lambda
# Lambda CPU scales linearly with memory (1792 MB = 1 full vCPU)
# Rule: more memory = faster execution = lower cost (if it reduces execution time enough)

import json

def calculate_optimal_memory(current_memory_mb, avg_duration_ms, invocations_per_month):
    """
    Given current memory, average duration, and estimated invocations,
    find the cost-optimal memory setting.
    """
    # Pricing: $0.0000166667 per GB-second (varies by region)
    gb_second_cost = 0.0000166667

    # Lambda scales CPU proportionally with memory up to 1792 MB
    # At 1792 MB, you get 1 full vCPU. Beyond that, CPU doesn't scale.
    # Execution time is roughly: (memory / current_memory) ^ -0.4
    # (diminishing returns on more memory)

    candidates = [128, 256, 512, 1024, 1769, 2048, 3008, 4096, 5120]
    best = None
    best_cost = float("inf")

    for mem in candidates:
        # Rough model: execution time proportional to inverse sqrt of memory
        speedup_factor = (current_memory_mb / mem) ** 0.4
        estimated_ms = avg_duration_ms * speedup_factor

        compute_cost = (mem / 1024) * (estimated_ms / 1000) * gb_second_cost * invocations_per_month
        print(f"  {mem:>5} MB → {estimated_ms:>6.0f} ms → ${compute_cost:>6.2f}/month")

        if compute_cost < best_cost:
            best_cost = compute_cost
            best = mem

    return best
```

### Common Anti-Patterns

- **Putting everything in a single function** — monolith functions
  grow deployment size, slow cold starts. Split by concern.
- **VPC for every Lambda** — VPC functions add 1-3s cold start
  latency. Only use VPC if you need to access RDS/ElastiCache in
  private subnets. For everything else (API calls, S3, DynamoDB),
  no VPC is faster.
- **Over-allocating memory** — 10GB Lambdas cost 10x more and
  don't always finish 10x faster. Profile first.
- **No provisioned concurrency for user-facing APIs** — every
  request hits a cold start is a bad user experience. Use
  provisioned concurrency for latency-sensitive paths.
- **Warmer every 1 minute** — pinging every 60s wastes money.
  Lambda idle timeout is ~5-15 minutes. Every 4-5 minutes is
  sufficient.

---

## 12. MONITORING & ALERTING

### Prometheus/Grafana: Opinionated Stack

```yaml
# prometheus-stack.yml (helm values)
prometheus:
  retention: 30d
  retentionSize: "50GB"
  scrapeInterval: 15s
  evaluationInterval: 30s

  rules:
    # Core infrastructure
    - alert: InstanceDown
      expr: up == 0
      for: 5m
      labels: { severity: critical }
      annotations:
        summary: "Instance {{ $labels.instance }} is down"

    - alert: HostHighCpu
      expr: 100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80
      for: 10m
      labels: { severity: warning }
      annotations:
        summary: "CPU > 80% on {{ $labels.instance }}"

    - alert: HostHighMemory
      expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 85
      for: 10m
      labels: { severity: warning }
      annotations:
        summary: "Memory > 85% on {{ $labels.instance }}"

    - alert: HostDiskFull
      expr: (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100 < 10
      for: 5m
      labels: { severity: critical }
      annotations:
        summary: "Disk < 10% free on {{ $labels.instance }}"
```

### Grafana Dashboard: Application Latency

```json
{
  "title": "Application Latency (p50 / p95 / p99)",
  "panels": [
    {
      "title": "Request Latency",
      "type": "timeseries",
      "targets": [
        {
          "expr": "histogram_quantile(0.50, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p50"
        },
        {
          "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p95"
        },
        {
          "expr": "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le))",
          "legendFormat": "p99"
        }
      ],
      "fieldConfig": {
        "thresholds": [
          { "value": null, "color": "green" },
          { "value": 200, "color": "yellow" },
          { "value": 500, "color": "red" }
        ]
      }
    },
    {
      "title": "Error Rate (5xx / total)",
      "type": "timeseries",
      "targets": [
        {
          "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) / sum(rate(http_requests_total[5m])) * 100",
          "legendFormat": "5xx %"
        }
      ],
      "fieldConfig": {
        "thresholds": [
          { "value": null, "color": "green" },
          { "value": 0.1, "color": "yellow" },
          { "value": 1.0, "color": "red" }
        ]
      }
    }
  ]
}
```

### Alert Fatigue Prevention

```
┌─────────────────────────────────────────────────────────┐
│ ALERT QUALITY GATE — Every alert must pass:             │
├─────────────────────────────────────────────────────────┤
│ 1. Is this actionable?  (Can someone DO something?)     │
│ 2. Is this urgent?       (If not, make it a dashboard)  │
│ 3. Is this accurate?     (Does it fire on signal, not   │
│                           noise? Low false-positive?)    │
│ 4. Does it have a runbook? (What should the responder   │
│                             actually do?)                │
│ 5. Is there a threshold?  ("High CPU" is vague — what   │
│                            number? For how long?)        │
│ 6. Is the severity right? (Paging at 3am vs ticket)     │
└─────────────────────────────────────────────────────────┘
```

### Alert Severity Assignment

| Severity | Pages? | Response | Examples |
|----------|--------|----------|----------|
| critical | Yes, 24/7 | ≤ 5 min | Site down, data loss, security breach |
| warning | Business hours | ≤ 1 hour | Latency spike, high error rate, disk > 80% |
| info | Ticket only | ≤ 1 week | Unattached resources, deprecation warnings |
| debug | Dashboard only | Best effort | Low-traffic anomalies, non-critical metrics |

### Multi-Window Multi-Burn-Rate (MWMBR) Alerts

The gold standard for SLO-based alerting. Short window catches
fast burns; long window catches slow burns. Both must fire for
alert to trigger (reduces false positives).

```yaml
# mwmbr-example.yml
# 3 burn-rate windows for a 99.9% SLO
groups:
  - name: mwmbr
    interval: 1m
    rules:
      # Fast burn: > 14.4% errors in 5m → budget exhausted in ≤ 6h
      - alert: FastBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            /
            sum(rate(http_requests_total[5m]))
          ) > 0.144
        for: 2m
        labels: { severity: critical }

      # Medium burn: > 3.6% errors in 30m → budget exhausted in ≤ 24h
      - alert: MediumBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[30m]))
            /
            sum(rate(http_requests_total[30m]))
          ) > 0.036
        for: 5m
        labels: { severity: warning }

      # Slow burn: > 1.2% errors in 6h → budget exhausted in ≤ 72h
      - alert: SlowBurnRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[6h]))
            /
            sum(rate(http_requests_total[6h]))
          ) > 0.012
        for: 10m
        labels: { severity: warning }

# Burn rate thresholds for common SLO targets:
# SLO  | Budget/30d | 5m (fast)  | 30m (med)  | 6h (slow)
# 99.9%| 0.1%       | > 14.4%    | > 3.6%     | > 1.2%
# 99.95%| 0.05%     | > 7.2%     | > 1.8%     | > 0.6%
# 99.99%| 0.01%     | > 1.44%    | > 0.36%    | > 0.12%
```

### Common Anti-Patterns

- **Alerting on every metric** — if every metric creates an alert,
  every alert is ignored. Only alert on symptoms, not causes.
- **No silencing during incidents** — the same alert paging every
  5 minutes during an active incident is noise. Suppress duplicates.
- **Static thresholds** — "CPU > 80%" works until you deploy a
  more efficient version that runs at 30%. Use SLO-based alerts
  or dynamic baselines where possible.
- **Paging the same person for every alert** — if one person gets
  paged for everything, they burn out and quit.

---

## 13. ON-CALL RUNBOOKS

### Runbook Structure

Every runbook must answer:

```
1. WHAT am I looking at?     (alert name + description)
2. HOW BAD is it?            (severity, affected users, metrics)
3. WHAT do I do first?       (immediate mitigation actions)
4. WHAT do I check next?     (diagnosis steps)
5. HOW do I fix it?          (remediation, with exact commands)
6. HOW do I verify?          (did it work? metrics check)
7. WHEN do I escalate?       (threshold for calling backup)
8. WHO do I hand off to?     (next on-call details)
```

### Runnable: Runbook Templates

#### Runbook: High Error Rate (5xx Spike)

```markdown
# RUNBOOK: High 5xx Error Rate

**Severity:** SEV-1 / SEV-2 (depending on %)
**Alert trigger:** Error rate > 1% for > 5 min

## 1. Verify the alert
- Check [Grafana dashboard](<link>) — confirm spike is real
- Cross-check with upstream alerts (DB, cache, downstream APIs)
- Isolate by endpoint (all or specific?) and region

## 2. Immediate mitigation (pick one)
  a) **Rollback recent deploy:**
     ```
     kubectl rollout undo deployment/api-server -n production
     # OR
     aws ecs update-service --cluster prod --service api --task-definition api:REVISION-1
     ```
     Verify: `kubectl rollout status deployment/api-server -n production`
     Wait 2 min → check error rate.

  b) **Feature flag off:**
     If a specific feature causes errors, disable it:
     ```
     curl -X POST https://feature-flags.example.com/flag/X/disable \
       -H "Authorization: Bearer $TOKEN"
     ```

  c) **Scale up** (if it's a capacity issue):
     ```
     kubectl scale deployment/api-server --replicas=15
     ```

## 3. Diagnosis
  - Check recent deploys: `git log --oneline -10`
  - Check p99 latency (high latency causes timeouts → 5xx):
    `http_request_duration_seconds{p99}`
  - Check DB connection pool: `pg_stat_activity` or RDS metrics
  - Check downstream APIs: downstream response time + error rate
  - Check logs: `kubectl logs -l app=api-server --tail=100 | grep "ERROR"`

## 4. Escalation triggers
  - ↑ 10 min: Notify secondary on-call
  - ↑ 20 min: Escalate to engineering manager
  - ↑ 30 min with no progress: Declare SEV-1 (if not already)

## 5. After resolution
  - Verify metrics back to baseline for 10 min
  - Post update to status page
  - Create postmortem ticket in JIRA
```

#### Runbook: Database Unreachable

```markdown
# RUNBOOK: Database Unreachable

**Severity:** SEV-1 (all queries fail)
**Alert trigger:** Database health check failing, connection errors

## 1. Verify
  - Test connectivity: `psql -h <host> -U <user> -d <db> -c "SELECT 1;"`
  - Check RDS / Cloud SQL console: is the instance running?
  - Check CloudWatch / metrics: `aws rds describe-db-instances`

## 2. Immediate mitigation
  **A) RDS failover:**
  ```
  aws rds failover-db-instance --db-instance-identifier <primary>
  ```
  Failover takes ~2-5 min. DB is unavailable during this time.
  Verify: `aws rds describe-db-instances --db-instance-identifier <primary>
    --query "DBInstances[0].DBInstanceStatus"`

  **B) Read replica promotion** (if writes can wait):
  ```
  aws rds promote-read-replica --db-instance-identifier <replica>
  ```
  Then update application connection string / DNS.

  **C) Connection pool reset:**
  ```
  kubectl rollout restart deployment/api-server
  ```
  (Sometimes the pool is full of stale connections.)

## 3. Diagnosis
  - CPU: `aws cloudwatch get-metric-statistics --metric-name CPUUtilization`
  - Connections: `aws rds describe-db-instances --query "DBInstances[0].DBParameterGroups"`
  - Disk space: `aws cloudwatch get-metric-statistics --metric-name FreeStorageSpace`
  - Recent deploys (schema migration?): `git log --oneline -10`
  - Slow queries: RDS Performance Insights → top SQL by avg latency

## 4. Escalation
  - If failover doesn't work → call DB admin / DBA
  - If data corruption suspected → do NOT restart; call SRE lead
  - If failover succeeded → verify RPO impact (how much data lost?)

## 5. After resolution
  - Verify app health: `curl https://api.example.com/healthz`
  - Check error rate is 0 for 5 min
  - Verify replication lag if replica was promoted
  - Postmortem ticket
```

#### Runbook: High CPU Saturation

```markdown
# RUNBOOK: High CPU / Slow Responses

**Severity:** SEV-2 (degraded performance)
**Alert trigger:** CPU > 80% for 10 min AND p95 latency > 500ms

## 1. Verify
  - Check Grafana CPU dashboard: is this a spike or sustained?
  - Cross-reference with p95/p99 latency and error rate
  - Check deploy timeline: did a new release trigger this?

## 2. Immediate mitigation
  **A) Scale out (horizontal):**
  ```
  kubectl scale deployment/api-server --replicas=20
  # Keep scaling until CPU < 60%
  ```

  **B) Provision more concurrency (Lambda):**
  ```
  aws lambda put-provisioned-concurrency-config \
    --function-name production-api \
    --qualifier production \
    --provisioned-concurrent-executions 25
  ```

  **C) Throttle non-critical traffic:**
  Enable rate limiting for non-authenticated / heavy endpoints.

## 3. Diagnosis
  - High CPU from traffic surge? Check request rate graphs.
  - High CPU from code change? Profile new code:
    `kubectl exec -it <pod> -- top -H`
  - Database queries slow? Check performance insights.
  - Memory leak? `kubectl top pods` — check memory trends.

## 4. Escalation
  - If auto-scaling is not helping → check launch template,
    ASG max size, service quota limits
  - If code related (regression) → rollback and notify dev team

## 5. Verification
  - CPU < 50% for 5 min
  - p95 latency < 200ms
  - Error rate < 0.1%
```

### Automated Remediation (Self-Healing)

```yaml
# auto-remediation-rules.yml
# Use with AWS Systems Manager Automation or K8s operators
rules:
  - alert: InstanceHanging
    condition: "node_cpu_utilization > 95% for 15m AND http_errors > 5%"
    action: |
      aws autoscaling terminate-instance-in-auto-scaling-group \
        --instance-id <instance> \
        --should-decrement-desired-capacity false

  - alert: DiskFull
    condition: "disk_usage > 90%"
    action: |
      # Run cleanup script
      docker system prune -af --volumes
      # OR rotate logs
      journalctl --vacuum-time=3d
      # If still > 90% after cleanup → escalate
      verify: "disk_usage < 80%"

  - alert: DeadLetterQueue
    condition: "sqs_dlq_messages > 0"
    action: |
      # Retry failed messages once
      aws sqs receive-message --queue-url <dlq-url> --max-number-of-messages 10
      # Re-drive to main queue
      aws sqs send-message-batch --queue-url <main-queue> --entries <messages>
```

### Common Anti-Patterns

- **Runbooks that are outdated** — if the runbook says "go to
  this URL" and the URL is 404, it's worse than no runbook.
  Review runbooks quarterly.
- **Runbooks that say "check the dashboard"** — specify WHICH
  dashboard, WHICH panel, what to look for.
- **Runbooks without escalation criteria** — the on-call engineer
  shouldn't have to decide when to escalate. Make it explicit.
- **No runbook for common alerts** — if an alert fires and there's
  no runbook, the on-call engineer wastes time figuring out what
  to do. Every alert type needs a runbook.
- **Automated remediation without logging** — if the system fixes
  itself silently, nobody knows there was an issue. Log every
  auto-remediation action.

---

## PRODUCTION READINESS CHECKLIST

### Reliability

- [ ] SLOs defined (at least availability and latency) with targets
- [ ] SLIs instrumented and visible in Grafana
- [ ] Error budget policy documented and understood by team
- [ ] Burn-rate alerts configured (multi-window)
- [ ] Redundant across ≥ 2 availability zones
- [ ] Health checks on all services (/healthz, /readyz)
- [ ] Graceful shutdown handling (SIGTERM → drain connections → exit)
- [ ] Startup probes delay readiness until service is warm

### Incident Response

- [ ] Severity levels defined (SEV-1 through SEV-5)
- [ ] On-call rotation configured with primary + secondary
- [ ] Escalation policy documented
- [ ] Incident communication templates ready (Slack, status page)
- [ ] Incident commander role assigned during exercises
- [ ] Postmortem template exists and is used after SEV-1/SEV-2
- [ ] Action items from postmortems tracked and have owners

### Disaster Recovery

- [ ] RTO and RPO documented and agreed with stakeholders
- [ ] DR strategy selected (backup/restore / pilot light / warm standby / active-active)
- [ ] Backups automated (3-2-1 rule)
- [ ] Backups encrypted
- [ ] Backup restore tested within last 90 days
- [ ] Failover runbook exists and tested within last 6 months
- [ ] Cross-region replication (if multi-region) has latency monitoring

### Observability

- [ ] Structured logging (JSON format, correlation IDs)
- [ ] Centralized log aggregation (Loki, Elastic, CloudWatch)
- [ ] Prometheus metrics on all services
- [ ] Grafana dashboards for: latency, errors, traffic, saturation (USE/RED method)
- [ ] Critical alerts page on-call (SMS / phone / Slack)
- [ ] Every alert has a runbook
- [ ] Alert fatigue prevention review completed (no duplicates, proper thresholds)
- [ ] Business metric dashboards (revenue, signups, active users)

### Security

- [ ] All secrets in secrets manager (not env vars in code)
- [ ] Database encrypted at rest
- [ ] Network encryption (TLS 1.2+)
- [ ] WAF / rate limiting on public endpoints
- [ ] Dependency vulnerability scanning in CI
- [ ] Least-privilege IAM policies
- [ ] Audit logging for admin actions

### Cost & Efficiency

- [ ] Right-sizing review completed in last 30 days
- [ ] Unused resources identified and removed
- [ ] Spot instances used for stateless/ fault-tolerant workloads
- [ ] Reserved capacity for steady-state workloads
- [ ] S3 lifecycle policies configured for log/backup storage
- [ ] Dev/staging environments auto-stopped outside hours

### Serverless (if applicable)

- [ ] Cold start mitigation for latency-sensitive functions
- [ ] Provisioned concurrency for user-facing APIs
- [ ] Function timeout ≤ 30s for API handlers
- [ ] Deployment package ≤ 50 MB (or use Layers)
- [ ] VPC functions justified (most don't need them)
- [ ] Reserved concurrency for critical functions

### Process

- [ ] Runbooks reviewed quarterly
- [ ] DR drill conducted within last 6 months
- [ ] Chaos engineering experiments run in staging
- [ ] On-call handover process documented
- [ ] Post-incident reviews held within 48h of resolution
- [ ] Error budget reviewed in monthly team meeting

## RULES

- ALWAYS include specific metric thresholds, not vague guidance
- ALWAYS tie reliability work to business impact (revenue, users, reputation)
- NEVER skip the human side (on-call, incident response, burnout)
- NEVER over-engineer monitoring for small apps — start with 3 SLOs, not 30
- ALWAYS produce runnable configs (Prometheus rules, Terraform, runbooks)
- ALWAYS keep runbooks current — stale runbooks are worse than none
- NEVER treat postmortems as blame exercises — systemic failures only
- ALWAYS test backups by restoring them
- NEVER let cost optimization compromise reliability (mix spot + on-demand)
- ALWAYS verify the rollback procedure before declaring a deploy "done"
