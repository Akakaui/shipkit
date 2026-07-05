---
title: Resilience Patterns
description: "Rate limiting, circuit breakers, retries with backoff, graceful degradation, bulkheads, timeout management."
triggers:
  - "rate limiting"
  - "circuit breaker"
  - "retry logic"
  - "graceful degradation"
  - "bulkhead pattern"
  - "timeout"
  - "resilience"
  - "fault tolerance"
owner-agent: backend
---

# Resilience Patterns

## Rate Limiting
- **Token bucket** (bursty traffic): `redis-rate-limiter` or in-memory
- **Sliding window** (smooth): `@upstash/ratelimit` or `express-rate-limit`
- Default: 100 req/min per IP (API), 10 req/min per IP (auth)
- Return `429 Too Many Requests` with `Retry-After` header

## Circuit Breaker
- Three states: **Closed** (passing), **Open** (failing), **Half-Open** (testing)
- Closed → Open: 5 failures in 30 seconds
- Open → Half-Open: After 30 seconds
- Half-Open → Closed: 3 successful probes
- Implementations: `opossum` (Node), `pybreaker` (Python), `resilience4j` (Java)
- Return `503 Service Unavailable` fast when open

## Retry with Backoff
- **Exponential backoff:** `base_delay × 2^attempt + jitter`
- **Jitter:** random(0, base_delay) to prevent thundering herd
- Default: 3 retries max
- Idempotency key for safe retries on POST/PUT

## Graceful Degradation
```yaml
priority:
  critical: [auth, checkout, read API]
  important: [search, recommendations]
  best-effort: [analytics, notifications]

strategy:
  critical: always available (redundant)
  important: fallback to cached results on failure
  best-effort: silently skip on failure
```

## Bulkheads
- Separate connection pools for different services
- Thread pool isolation for different task types
- Failure domain: one component's failure doesn't cascade
- Resource quotas per tenant (in multi-tenant systems)

## Timeout Management
- **Connect timeout:** 5s
- **Read timeout:** 15s (API), 30s (batch)
- **Total request timeout:** 30s (API), 120s (batch)
- Cancel downstream calls on timeout (context cancellation)

## Observability
- Log every circuit breaker state change
- Metric: `circuit_breaker_state{service, state}`
- Metric: `retry_count{service, attempt}`
- Metric: `rate_limit_hits{route, ip}`
- Alert on circuit breaker open for > 5 minutes
