# RESILIENCE PATTERNS — Fault Tolerance & Production Stabilization

## PURPOSE

Defines and implements the core resilience patterns every
production system needs: circuit breakers, retries, timeouts,
idempotency, dead letter queues, bulkheads, backpressure,
rate limiting, graceful degradation, health checks, and
distributed locking.

Use this skill when the production-hardening orchestrator
routes to it, or when the user asks for any of these patterns.

## TRIGGERS

- "Add a circuit breaker"
- "Implement retry logic"
- "Configure timeouts"
- "Set up idempotency"
- "Dead letter queue setup"
- "Bulkhead pattern"
- "Backpressure handling"
- "Rate limiting"
- "Graceful degradation"
- "Health checks"
- "Health endpoints"
- "Liveness vs readiness"
- "Distributed locking"
- "Optimistic / pessimistic locking"
- "Race conditions / deadlocks"
- "Redlock"
- "Resilience testing"
- "Fault tolerance"
- "Any term: circuit breaker, retry, backoff, jitter, idempotency key, DLQ, bulkhead, semaphore isolation, token bucket, leaky bucket, 429, /health, /ready, Redlock, fencing token"

---

## 1. CIRCUIT BREAKER

### Problem

A downstream service is failing or slow. Without a circuit breaker,
every caller also fails or blocks threads cascading the failure.
With a circuit breaker, after a threshold of failures, the circuit
"opens" (fast-fails) so the system can recover.

### State Machine

```
Closed ──(failure threshold exceeded)──→ Open
  ↑                                          │
  │                               (timeout elapses)
  │                                          ↓
  └────────(success threshold)─── Half-Open ──┘
```

- **Closed**: Requests pass normally. Failures counted.
- **Open**: Requests fast-fail immediately. Error returned.
- **Half-Open**: Single probe request allowed. Success → close; Failure → open again.

### Node.js Implementation (opossum)

```typescript
import CircuitBreaker from 'opossum';

interface CircuitBreakerOptions {
  timeout?: number;           // ms before request times out (default 3000)
  errorThresholdPercentage?: number; // % failures to open (default 50)
  resetTimeout?: number;      // ms before half-open probe (default 30000)
  volumeThreshold?: number;   // min requests before stats matter (default 5)
  name?: string;              // metrics label
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
}

async function callExternalApi(payload: unknown): Promise<unknown> {
  // your actual API call
  const response = await fetch('https://api.example.com/process', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}

const breakerOptions: CircuitBreakerOptions = {
  timeout: 5000,
  errorThresholdPercentage: 50,
  resetTimeout: 30000,
  volumeThreshold: 5,
  name: 'example-api',
};

const breaker = new CircuitBreaker(callExternalApi, breakerOptions);

// Event listeners for monitoring
breaker.on('open', () => console.warn('[CIRCUIT] OPEN — fast-failing'));
breaker.on('halfOpen', () => console.info('[CIRCUIT] HALF-OPEN — testing'));
breaker.on('close', () => console.info('[CIRCUIT] CLOSED — recovered'));
breaker.on('reject', () => console.warn('[CIRCUIT] REJECTED — request blocked'));

// Fallback on open circuit
const fallbackFn = () => ({ cached: true, data: null });

// Usage
async function handleRequest(payload: unknown) {
  try {
    return await breaker.fire(payload);
  } catch (err) {
    if ((err as Error).message === 'Breaker is open') {
      return fallbackFn();
    }
    throw err;
  }
}

// Export for health check
export { breaker };
```

### Python Implementation (resilience4j / pybreaker)

```python
import time
from functools import wraps
from typing import Callable, Optional


class CircuitBreakerState:
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitBreaker:
    """Minimal circuit breaker — use pybreaker or resilience4j for production."""

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        success_threshold: int = 2,
        name: str = "default",
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.success_threshold = success_threshold
        self.state = CircuitBreakerState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time = 0.0

    def __call__(self, fn: Callable):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if self.state == CircuitBreakerState.OPEN:
                if time.monotonic() - self._last_failure_time >= self.recovery_timeout:
                    self.state = CircuitBreakerState.HALF_OPEN
                    self._success_count = 0
                    print(f"[{self.name}] HALF-OPEN — probe allowed")
                else:
                    raise CircuitBreakerOpenError(self.name)

            try:
                result = fn(*args, **kwargs)
                self._on_success()
                return result
            except Exception as e:
                self._on_failure()
                raise e

        return wrapper

    def _on_success(self):
        if self.state == CircuitBreakerState.HALF_OPEN:
            self._success_count += 1
            if self._success_count >= self.success_threshold:
                self.state = CircuitBreakerState.CLOSED
                self._failure_count = 0
                print(f"[{self.name}] CLOSED — recovered")
        else:
            self._failure_count = 0  # reset on success in closed

    def _on_failure(self):
        self._last_failure_time = time.monotonic()
        if self.state == CircuitBreakerState.HALF_OPEN:
            self.state = CircuitBreakerState.OPEN
            print(f"[{self.name}] OPEN — half-open probe failed")
            return
        self._failure_count += 1
        if self._failure_count >= self.failure_threshold:
            self.state = CircuitBreakerState.OPEN
            print(f"[{self.name}] OPEN — threshold reached")


class CircuitBreakerOpenError(Exception):
    def __init__(self, name: str):
        super().__init__(f"Circuit breaker '{name}' is open")
        self.breaker_name = name


# Usage
breaker = CircuitBreaker(name="payment-service", failure_threshold=3)

@breaker
def call_payment_api(order_id: str) -> dict:
    # actual HTTP call
    ...
```

### Common Pitfalls

- **Volume threshold too low**: Circuit opens on a single timeout spike. Set `volumeThreshold` so transient blips don't trigger.
- **Reset timeout too short**: Service gets slammed with half-open probes before it recovers. Minimum 10-30s for external APIs.
- **No fallback**: Open circuit still throws. Always provide a fallback (cache, degraded response, queued retry).
- **Not tracking per-request-type**: A circuit breaker on a mixed client pools failures across unrelated operations.

### Verification

```bash
# Trigger failures, confirm circuit opens
curl -X POST http://localhost:4000/api/proxy -d '{"fail": true}' -w "\n%{http_code}"
# Should return 503 or fallback response once threshold hit

# Check metrics endpoint
curl http://localhost:4000/metrics | grep circuit_breaker
```

**Monitoring**: Alert on `circuit_breaker_state{name="X"} == 1` (open). Track open duration P99.

---

## 2. RETRIES WITH EXPONENTIAL BACKOFF

### Problem

Transient failures (network glitches, connection resets, 503
Service Unavailable) are temporary. Without retries, the system
treats them as permanent. Without exponential backoff, retries
overwhelm the recovering service.

### Backoff Strategies

| Strategy | Formula | Jitter | Best For |
|----------|---------|--------|----------|
| **Full Jitter** | `random(0, base * 2^attempt)` | Maximum | High-traffic systems, prevents thundering herd |
| **Equal Jitter** | `base * 2^attempt / 2 + random(0, base * 2^attempt / 2)` | Moderate | General purpose |
| **Decorrelated Jitter** | `min(cap, random(base, sleep_prev * 3))` | Asymmetric | Long-running retries, erratic services |

### Node.js Implementation

```typescript
export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: 'full' | 'equal' | 'decorrelated';
  retryableStatuses?: number[];
  retryableErrors?: RegExp[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxRetries,
    baseDelayMs,
    maxDelayMs,
    jitter,
    retryableStatuses = [408, 429, 502, 503, 504],
    retryableErrors = [/ECONNRESET/i, /ETIMEDOUT/i, /ENOTFOUND/i, /Service Unavailable/i],
    onRetry,
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;

      if (attempt === maxRetries) break;

      // Check if error is retryable
      const isRetryable = isErrorRetryable(err, retryableStatuses, retryableErrors);
      if (!isRetryable) break;

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs, jitter);
      onRetry?.(attempt + 1, err as Error, delay);
      await sleep(delay);
    }
  }

  throw lastError;
}

function isErrorRetryable(
  err: unknown,
  statuses: number[],
  errorPatterns: RegExp[],
): boolean {
  const error = err as Record<string, unknown>;

  // HTTP status check
  if (typeof error.status === 'number' && statuses.includes(error.status)) {
    return true;
  }

  // Error message pattern check
  const message = String(error.message || '');
  return errorPatterns.some((pattern) => pattern.test(message));
}

function calculateDelay(
  attempt: number,
  base: number,
  cap: number,
  strategy: string,
): number {
  const exp = Math.min(cap, base * Math.pow(2, attempt));

  switch (strategy) {
    case 'full':
      return randomBetween(0, exp);
    case 'equal':
      return exp / 2 + randomBetween(0, exp / 2);
    case 'decorrelated': {
      if (attempt === 0) return randomBetween(0, Math.min(cap, base));
      const prev = Math.min(cap, base * Math.pow(2, attempt - 1));
      return Math.min(cap, randomBetween(base, prev * 3));
    }
    default:
      return exp;
  }
}
```

### Python Implementation

```python
import asyncio
import random
from functools import wraps
from typing import Callable, Optional


def with_retry(
    max_retries: int = 3,
    base_delay: float = 0.1,
    max_delay: float = 60.0,
    jitter: str = "full",
    retryable_statuses: Optional[set[int]] = None,
):
    """Async retry decorator with exponential backoff."""
    if retryable_statuses is None:
        retryable_statuses = {408, 429, 502, 503, 504}

    def decorator(fn: Callable):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_retries + 1):
                try:
                    return await fn(*args, **kwargs)
                except Exception as exc:
                    last_exc = exc
                    if attempt == max_retries:
                        break

                    # Check retryability
                    status = getattr(exc, "status", 0) or getattr(exc, "status_code", 0)
                    if status and status not in retryable_statuses:
                        break

                    delay = _calculate_delay(attempt, base_delay, max_delay, jitter)
                    print(f"[retry] attempt {attempt+1}/{max_retries}, "
                          f"waiting {delay:.2f}s: {exc}")
                    await asyncio.sleep(delay)

            raise last_exc
        return wrapper
    return decorator


def _calculate_delay(attempt: int, base: float, cap: float, strategy: str) -> float:
    exp = min(cap, base * (2 ** attempt))
    if strategy == "full":
        return random.uniform(0, exp)
    elif strategy == "equal":
        return exp / 2 + random.uniform(0, exp / 2)
    elif strategy == "decorrelated":
        if attempt == 0:
            return random.uniform(0, min(cap, base))
        prev = min(cap, base * (2 ** (attempt - 1)))
        return min(cap, random.uniform(base, prev * 3))
    return exp
```

### Retry Budget

Prevent cascading retries by budgeting:

```
retry_budget_requests_per_sec = normal_traffic_per_sec * 0.20
# If normal = 1000 RPS, budget = 200 RPS for retries
# When exceeded, fail fast instead of retrying
```

```typescript
class RetryBudget {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private maxTokens: number,
    private refillRate: number, // tokens per second
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  consume(): boolean {
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }
}

const budget = new RetryBudget(100, 10); // 100 burst, 10/sec refill
// Before retry: if (!budget.consume()) return failFast();
```

### Common Pitfalls

- **Retrying non-idempotent requests without idempotency keys** → duplicate charges.
- **Unbounded retries** → 30+ second cascading stalls. Always cap `maxRetries` (3-5 typical).
- **Retrying on 4xx errors** → Client errors won't succeed on retry. Only retry 5xx, 408, 429.
- **Same retry delay across all services** → Database retries need shorter delays than external APIs.

### Verification

```bash
# Simulate flaky endpoint with 50% failure rate
# Confirm retry count = 3 before giving up
# Confirm eventual success after transient failures
# Confirm non-retryable errors (400) are NOT retried
```

**Metrics to track**: `retry_attempts_total{service,status}`, `retry_budget_exhausted_total`

---

## 3. TIMEOUTS

### Problem

A downstream service hangs. Without timeouts, the caller blocks
indefinitely — threads pool exhausts, connections leak, and the
entire application becomes unresponsive.

### Three Layers of Timeout

| Type | What It Protects | Typical Value |
|------|-----------------|---------------|
| **Connect** | DNS + TCP handshake hang | 1-5s |
| **Read** | Response body stall mid-stream | 5-30s |
| **Write** | Request body upload stall | 5-10s |

### Node.js Implementation

```typescript
import http from 'node:http';
import https from 'node:https';

interface ServiceTimeoutConfig {
  connectTimeoutMs: number;
  readTimeoutMs: number;
  writeTimeoutMs: number;
}

// Per-service timeouts
const SERVICE_TIMEOUTS: Record<string, ServiceTimeoutConfig> = {
  'payment-gateway': { connectTimeoutMs: 2000, readTimeoutMs: 10000, writeTimeoutMs: 5000 },
  'user-db':         { connectTimeoutMs: 1000, readTimeoutMs: 3000,  writeTimeoutMs: 2000 },
  'email-service':   { connectTimeoutMs: 3000, readTimeoutMs: 15000, writeTimeoutMs: 5000 },
};

// HTTP client with explicit timeouts
async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 10000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// Per-service client
class ServiceClient {
  constructor(private config: ServiceTimeoutConfig) {}

  async request(path: string, body?: unknown): Promise<Response> {
    const controller = new AbortController();
    const connectTimer = setTimeout(() => controller.abort(), this.config.connectTimeoutMs);

    try {
      const response = await fetch(`https://api.example.com${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      // Read timeout (stream must complete within limit)
      const reader = response.body?.getReader();
      if (!reader) return response;

      const readTimer = setTimeout(() => {
        reader.cancel();
        controller.abort();
      }, this.config.readTimeoutMs);

      try {
        // consume stream
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        return new Response(new Blob(chunks), response);
      } finally {
        clearTimeout(readTimer);
      }
    } finally {
      clearTimeout(connectTimer);
    }
  }
}
```

### Deadline Propagation (gRPC-style)

```typescript
// Propagate deadline across service calls
export interface Deadline {
  deadlineMs: number; // absolute epoch ms
}

export function createDeadline(timeoutMs: number): Deadline {
  return { deadlineMs: Date.now() + timeoutMs };
}

export function getRemainingMs(deadline: Deadline): number {
  const remaining = deadline.deadlineMs - Date.now();
  return Math.max(0, remaining);
}

// Pass in headers/metadata between services
async function callDownstream(
  path: string,
  deadline: Deadline,
): Promise<Response> {
  const remaining = getRemainingMs(deadline);
  if (remaining <= 0) throw new Error('Deadline exceeded');

  // Use min(remaining, default_timeout) as actual timeout
  const timeout = Math.min(remaining, 5000);
  return fetchWithTimeout(path, { timeoutMs: timeout });
}
```

### Python Implementation

```python
import asyncio
from contextlib import asynccontextmanager


@asynccontextmanager
async def timeout(seconds: float):
    """Async timeout context manager."""
    try:
        yield await asyncio.wait_for(asyncio.sleep(0), timeout=seconds)
    except asyncio.TimeoutError:
        raise TimeoutError(f"Operation timed out after {seconds}s")


# Usage
async def fetch_data():
    async with timeout(5.0):
        # This will raise TimeoutError if it runs > 5s
        return await http_client.get("https://api.example.com/data")
```

### Common Pitfalls

- **One global timeout for all services** → Fast services (DB) need tight timeouts; slow ones (AI inference) need generous ones.
- **No deadline propagation** → A request with a 5s timeout calls service A (3s), then service B (3s) — B still tries for 3s even though only 2s remain.
- **Only connect timeout** → Connection succeeds but the response stream hangs. Always set read timeout too.
- **AbortController not cleaned up** → Memory leaks from uncleared timers. Always use try/finally.

### Verification

```bash
# Cause a slow endpoint to confirm timeout fires
# Expect: 504 Gateway Timeout or operation-specific error

# Verify deadline propagation
# Request with 1s timeout -> B receives <1s remaining -> B should fail fast
```

**Metrics**: `http_client_timeout_total{service,type}`, `deadline_exceeded_total`

---

## 4. IDEMPOTENCY

### Problem

A retry causes duplicate side effects: double charge, duplicate
order, duplicate notification. Idempotency ensures retries are
safe by making each operation identifiable and deduplicatable.

### Idempotency Key Pattern

```
Client (generates idempotency key)  →  POST /payments
Headers: Idempotency-Key: uuid-123

Server:
  1. Check cache (Redis): key "uuid-123" exists?
  2. If yes → return stored response (dedup)
  3. If no → process, store result with TTL, return
```

### Node.js Implementation

```typescript
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL });

export interface IdempotencyConfig {
  ttlMs: number;         // How long to keep the key (24h typical)
  keyPrefix: string;     // "idempotency:"
}

// Server middleware (Express/Fastify)
export function idempotencyMiddleware(config: IdempotencyConfig) {
  return async (req: any, res: any, next: any) => {
    // Skip for GET/HEAD (naturally idempotent)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

    const key = req.headers['idempotency-key'] as string;
    if (!key) {
      return res.status(400).json({
        error: 'Missing Idempotency-Key header',
        detail: 'POST/PUT/PATCH requests require an Idempotency-Key header (UUID v4)',
      });
    }

    const redisKey = `${config.keyPrefix}${key}`;

    try {
      // Check for existing result
      const existing = await redis.get(redisKey);
      if (existing) {
        const stored = JSON.parse(existing);
        // Return original status + body
        return res.status(stored.status).json(stored.body);
      }

      // Store a "processing" marker with short TTL to prevent concurrent duplicates
      const locked = await redis.set(redisKey, 'processing', {
        NX: true,
        PX: 5000, // 5s initial lock
      });

      if (!locked) {
        return res.status(409).json({
          error: 'Request is already being processed',
          detail: 'A request with this idempotency key is in-flight',
        });
      }

      // Wrap response to capture result
      const originalJson = res.json.bind(res);
      res.json = function (body: unknown) {
        const response = { status: res.statusCode, body };
        // Store result with configured TTL
        redis.setEx(redisKey, config.ttlMs / 1000, JSON.stringify(response))
          .catch((err) => console.error('Failed to store idempotency result:', err));
        return originalJson(body);
      };

      next();
    } catch (err) {
      next(err);
    }
  };
}

// Client-side helper
export function withIdempotency<T>(fn: () => Promise<T>): Promise<T> {
  const key = randomUUID();
  const wrapped = fn as unknown as { idempotencyKey?: string };
  wrapped.idempotencyKey = key;
  return fn();
}

export async function idempotentPost<T>(
  url: string,
  body: unknown,
  options?: { timeoutMs?: number },
): Promise<T> {
  const idempotencyKey = randomUUID();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: options?.timeoutMs
      ? AbortSignal.timeout(options.timeoutMs)
      : undefined,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
```

### Python Implementation

```python
import uuid
from functools import wraps
from typing import Callable, Optional
import redis.asyncio as aioredis


class IdempotencyMiddleware:
    """ASGI middleware for idempotency support."""

    def __init__(
        self,
        app: Callable,
        redis_url: str = "redis://localhost:6379",
        ttl_seconds: int = 86400,
        key_prefix: str = "idempotency:",
    ):
        self.app = app
        self.redis = aioredis.from_url(redis_url)
        self.ttl = ttl_seconds
        self.prefix = key_prefix

    async def __call__(self, scope, receive, send):
        if scope["method"] in ("GET", "HEAD", "OPTIONS"):
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        key = headers.get(b"idempotency-key", b"").decode()

        if not key:
            return await self._send_json(send, 400, {
                "error": "Missing Idempotency-Key header",
            })

        redis_key = f"{self.prefix}{key}"
        existing = await self.redis.get(redis_key)

        if existing:
            if existing == b"processing":
                return await self._send_json(send, 409, {
                    "error": "Request already in progress",
                })
            # Return original response
            import json
            data = json.loads(existing)
            return await self._send_json(send, data["status"], data["body"])

        # Lock
        locked = await self.redis.set(redis_key, "processing", nx=True, px=5000)
        if not locked:
            return await self._send_json(send, 409, {
                "error": "Request already in progress",
            })

        # Capture response
        async def capture_send(event):
            if event["type"] == "http.response.start":
                status = event["status"]
                body_events = []

                async def capture_body(body_event):
                    body_events.append(body_event)

                original_send = send
                # Actually intercept body (simplified — use middleware lib in prod)
            await send(event)

        await self.app(scope, receive, send)

    async def _send_json(self, send, status: int, body: dict):
        import json
        data = json.dumps(body).encode()
        await send({
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json")],
        })
        await send({
            "type": "http.response.body",
            "body": data,
        })
```

### Idempotency Key Strategy by HTTP Method

| Method | Idempotent? | Key Strategy |
|--------|-------------|-------------|
| GET | Yes | No key needed — safe to repeat |
| PUT | Yes (full replace) | Client-generated key recommended |
| PATCH | No | Always use idempotency key |
| POST | No | Always use idempotency key |
| DELETE | Yes | Key optional but recommended |

### Common Pitfalls

- **TTL too short** → Response stored for 5 minutes but client retries after 10. Key expires, second request processes → duplicate. TTL should match your client's max retry window (24h typical).
- **Not returning the exact same response** → Client receives 200 on first call, 201 on retry. Breaks client logic. Store and replay the exact status + body.
- **Missing "processing" lock** → Two concurrent requests with the same key both pass the idempotency check. Use atomic `SET NX` or `SETNX` with short expiry.
- **Idempotency on non-write endpoints** → GET requests already idempotent. Adding key overhead is unnecessary.

### Verification

```bash
# Send request with key
curl -X POST http://localhost:4000/api/orders \
  -H "Idempotency-Key: test-key-1" \
  -H "Content-Type: application/json" \
  -d '{"item": "book"}'

# Replay exact same request (should return same result, not duplicate)
curl -X POST http://localhost:4000/api/orders \
  -H "Idempotency-Key: test-key-1" \
  -H "Content-Type: application/json" \
  -d '{"item": "book"}'

# Verify only ONE order created
```

**Metrics**: `idempotency_hits_total`, `idempotency_conflicts_total`

---

## 5. DEAD LETTER QUEUES (DLQ)

### Problem

A message fails processing repeatedly. Without a DLQ, it's
either retried infinitely (blocking the queue) or silently
dropped (data loss). A DLQ captures the poison message for
inspection and manual or automated remediation.

### Architecture

```
Producer → Exchange/Topic → Queue → Consumer
                                    │ (retry N times, then)
                                    ↓
                                DLQ → Inspector/Alert → Republish or Archive
```

### RabbitMQ DLQ Setup

```yaml
# Declared via policy or per-queue
# RabbitMQ policy (applied via CLI or Management UI)
rabbitmqctl set_policy dlx "^primary\." '{
  "dead-letter-exchange": "dlx",
  "dead-letter-routing-key": "dlq",
  "message-ttl": 30000,
  "max-retries": 3
}' --apply-to queues
```

```typescript
// Node.js — amqplib with DLQ
import amqp from 'amqplib';

async function setupQueues(channel: amqp.Channel) {
  // Dead letter exchange
  await channel.assertExchange('dlx', 'direct', { durable: true });

  // Dead letter queue
  await channel.assertQueue('dlq', {
    durable: true,
    arguments: {
      'x-message-ttl': 7 * 24 * 60 * 60 * 1000, // 7 days retention
    },
  });
  await channel.bindQueue('dlq', 'dlx', 'dlq');

  // Primary queue with DLQ config
  await channel.assertQueue('orders.primary', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'dlx',
      'x-dead-letter-routing-key': 'dlq',
      'x-message-ttl': 30000,           // 30s per retry attempt
      'x-max-retries': 3,               // max delivery attempts
    },
  });

  // Retry queue (for re-processing DLQ'd messages)
  await channel.assertQueue('orders.retry', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': '',      // default exchange
      'x-dead-letter-routing-key': 'orders.primary',
      'x-message-ttl': 60000,            // 1 min before retry
    },
  });
}

// Consumer with retry count
async function consumeOrders(channel: amqp.Channel) {
  await channel.consume('orders.primary', async (msg) => {
    if (!msg) return;

    const headers = msg.properties.headers || {};
    const retryCount = headers['x-retry-count'] || 0;

    try {
      await processOrder(msg.content.toString());
      channel.ack(msg);
    } catch (err) {
      if (retryCount >= 2) {
        // Send to DLQ after 3 total attempts
        channel.reject(msg, false); // false = don't requeue -> goes to DLX
        console.error(`[DLQ] Order failed after ${retryCount} retries`, msg.content.toString());
      } else {
        // Reject with requeue=false but publish to retry queue
        channel.reject(msg, false); // goes to DLX
        // (The DLX routes to dlq, but we want a delayed retry)
        // Alternative: manually publish to retry queue
        channel.publish('', 'orders.retry', msg.content, {
          headers: { ...headers, 'x-retry-count': retryCount + 1 },
          persistent: true,
        });
        console.warn(`[RETRY] Scheduling retry ${retryCount + 1} for order`);
      }
    }
  });
}
```

### Kafka DLQ Setup

```yaml
# Kafka Streams DLQ config
spring:
  kafka:
    template:
      default-topic: orders
    consumer:
      properties:
        # Enable DLQ via Spring Cloud Stream
        enable-dlq: true
        dlq-name: orders-dlq
        dlq-max-attempts: 3
        dlq-retry-backoff-ms: 1000
```

```typescript
// Node.js — KafkaJS with DLQ
import { Kafka, Producer, Consumer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: process.env.KAFKA_BROKERS?.split(',') ?? [],
});

const dlqProducer: Producer = kafka.producer();

export async function consumeWithDLQ(consumer: Consumer) {
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      const retryCount = Number(message.headers['retry-count'] ?? 0);

      try {
        await processOrder(message.value!.toString());
      } catch (err) {
        if (retryCount >= 3) {
          // Route to DLQ topic
          await dlqProducer.send({
            topic: `${topic}-dlq`,
            messages: [{
              value: message.value,
              headers: {
                ...message.headers,
                'original-topic': topic,
                'original-partition': String(partition),
                'original-offset': String(message.offset),
                'failure-reason': String(err),
                'failed-at': new Date().toISOString(),
              },
            }],
          });
          console.error(`[DLQ] Message sent to ${topic}-dlq`);
        } else {
          // Retry with backoff
          await consumer.pause([{ topic, partitions: [partition] }]);
          setTimeout(() => {
            consumer.resume([{ topic, partitions: [partition] }]);
          }, Math.pow(2, retryCount) * 1000);
        }
      }
    },
  });
}
```

### SQS DLQ Setup

```hcl
# Terraform — AWS SQS + DLQ
resource "aws_sqs_queue" "orders_dlq" {
  name                       = "orders-dlq"
  message_retention_seconds  = 1209600  # 14 days
  visibility_timeout_seconds = 30
}

resource "aws_sqs_queue" "orders" {
  name                        = "orders"
  visibility_timeout_seconds  = 60
  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.orders_dlq.arn
    maxReceiveCount     = 3  # move to DLQ after 3 receives (fails)
  })
}
```

### DLQ Monitoring

```yaml
# Prometheus alert for DLQ depth
groups:
  - name: dlq-alerts
    rules:
      - alert: DLQDepthIncreasing
        expr: |
          aws_sqs_approximate_number_of_messages_visible{queue_name="orders-dlq"} > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "DLQ {{ $labels.queue_name }} has messages"
          description: "DLQ has been non-empty for 5m. Check consumer health."

      - alert: DLQDepthCritical
        expr: |
          aws_sqs_approximate_number_of_messages_visible{queue_name="orders-dlq"} > 100
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "DLQ {{ $labels.queue_name }} has 100+ messages"
```

### DLQ Redrive

```bash
# AWS SQS — redrive DLQ messages back to source queue
aws sqs start-message-move-task \
  --source-arn arn:aws:sqs:us-east-1:123456789012:orders-dlq \
  --destination-arn arn:aws:sqs:us-east-1:123456789012:orders
```

### Common Pitfalls

- **No DLQ alerting** → DLQ fills silently. Always alert on `DLQ depth > 0` for > 5m.
- **Infinite DLQ growth** → DLQ retention set to "forever". Set TTL or a cleanup job.
- **DLQ without inspection UI** → Dead messages are invisible. Build a DLQ dashboard or use SQS console.
- **Re-consuming without fixing** → Redrive without analysis = same failures again. Always inspect first.

### Verification

```bash
# Publish a poison message that always fails
# Confirm it reaches the DLQ after maxRetries
# Confirm alert fires on non-empty DLQ
# Redrive and confirm reprocessing
```

**Metrics**: `dlq_depth{queue}`, `dlq_in_rate{queue}`, `messages_retried_total`

---

## 6. BULKHEADS

### Problem

A failing service exhausts shared resources (thread pool,
connection pool). The failure cascades to unrelated services.
Bulkheads isolate resources so one failure can't sink the ship.

### Thread Pool vs Semaphore Isolation

| Pattern | Isolation Level | Use Case |
|---------|----------------|----------|
| **Thread pool** | Separate thread pool per downstream | Slow operations, blocking I/O |
| **Semaphore** | Count concurrent calls, same thread | Fast operations, async I/O |

### Node.js Implementation

```typescript
// Thread pool bulkhead via worker_threads
import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';

interface BulkheadOptions {
  maxConcurrent: number;
  maxQueue: number;
  name: string;
  timeoutMs?: number;
}

export class Bulkhead extends EventEmitter {
  private active = 0;
  private queue: Array<{
    fn: () => Promise<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: Error) => void;
  }> = [];
  private rejected = 0;

  constructor(private options: BulkheadOptions) {
    super();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.options.maxConcurrent) {
      if (this.queue.length >= this.options.maxQueue) {
        this.rejected++;
        this.emit('rejected', { name: this.options.name });
        throw new Error(`Bulkhead "${this.options.name}" queue full`);
      }
      return new Promise((resolve, reject) => {
        this.queue.push({ fn, resolve, reject } as any);
      });
    }

    return this.run(fn);
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.active++;
    try {
      const result = await fn();
      return result;
    } finally {
      this.active--;
      this.dequeue();
    }
  }

  private dequeue() {
    if (this.queue.length > 0 && this.active < this.options.maxConcurrent) {
      const next = this.queue.shift()!;
      this.run(next.fn).then(next.resolve).catch(next.reject);
    }
  }

  getStats() {
    return {
      name: this.options.name,
      active: this.active,
      queued: this.queue.length,
      rejected: this.rejected,
      maxConcurrent: this.options.maxConcurrent,
    };
  }
}

// Per-service bulkheads
export const bulkheads = {
  payment: new Bulkhead({ maxConcurrent: 5, maxQueue: 10, name: 'payment' }),
  email:   new Bulkhead({ maxConcurrent: 10, maxQueue: 20, name: 'email' }),
  search:  new Bulkhead({ maxConcurrent: 20, maxQueue: 50, name: 'search' }),
  db:      new Bulkhead({ maxConcurrent: 15, maxQueue: 30, name: 'database' }),
};

// Usage
async function createOrder(order: unknown) {
  return bulkheads.payment.execute(async () => {
    return paymentClient.charge(order);
  });
}

// Semaphore-based bulkhead (lighter, same thread)
class SemaphoreBulkhead {
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(
    private maxConcurrency: number,
    private name: string,
  ) {}

  async acquire(): Promise<void> {
    if (this.active < this.maxConcurrency) {
      this.active++;
      return;
    }
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next(); // defer to next microtask
    } else {
      this.active--;
    }
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}
```

### Python Implementation

```python
import asyncio
from dataclasses import dataclass


@dataclass
class Bulkhead:
    max_concurrent: int
    max_queue: int = 0
    name: str = "default"

    def __post_init__(self):
        self._semaphore = asyncio.Semaphore(self.max_concurrent)
        self._queue = asyncio.Queue(maxsize=self.max_queue)
        self._rejected_count = 0

    async def run(self, coro):
        if self._semaphore.locked() and self.max_queue > 0:
            try:
                self._queue.put_nowait(None)
            except asyncio.QueueFull:
                self._rejected_count += 1
                raise BulkheadRejected(self.name)

        async with self._semaphore:
            if not self._queue.empty():
                self._queue.get_nowait()
            return await coro

    @property
    def stats(self):
        return {
            "name": self.name,
            "active": self.max_concurrent - self._semaphore._value,
            "queued": self._queue.qsize(),
            "rejected": self._rejected_count,
        }


class BulkheadRejected(Exception):
    def __init__(self, name: str):
        super().__init__(f"Bulkhead '{name}' rejected request")
        self.bulkhead_name = name
```

### Common Pitfalls

- **Too many bulkheads** → Each bulkhead adds complexity. Only isolate services with different failure characteristics.
- **Queue too large** → Bulkhead with unbounded queue = hidden resource drain. Cap queue at 2-3x concurrency.
- **Metrics not tracked** → Can't tune bulkheads without `active`, `queued`, `rejected` counters.
- **Bulkhead without timeout** → A stuck call holds a permit forever. Always pair bulkhead with a timeout.

### Verification

```bash
# Simulate slow payment service (5s delay)
# While in-flight, confirm payment bulkhead rejects at maxConcurrent
# Confirm email and db calls still succeed (isolated)
# Confirm rejected count increments
```

**Metrics**: `bulkhead_active{name}`, `bulkhead_queued{name}`, `bulkhead_rejected_total{name}`

---

## 7. BACKPRESSURE

### Problem

Producer outpaces consumer. Without backpressure, the consumer's
queues grow unbounded, memory fills, GC pressure spikes, and the
system OOMs. Backpressure lets the consumer tell the producer to
slow down.

### Strategies

| Strategy | Mechanism | Use Case |
|----------|-----------|----------|
| **Queue depth signaling** | Producer checks queue depth before sending | Async message systems |
| **TCP backpressure** | Kernel buffers fill, TCP window closes | Network services, HTTP/2 |
| **HTTP 429/503** | Server responds with retry-after | REST APIs, rate-limited services |
| **Reactive streams** | Subscription-based demand signals (backpressure protocol) | Stream processing, RxJS, WebFlux |

### Node.js — Reactive Streams Backpressure

```typescript
// Readable stream that respects consumer demand
import { Readable, Writable, Transform, pipeline } from 'node:stream';

// Producer respects backpressure via .push() return value
class DataProducer extends Readable {
  private index = 0;

  constructor(private maxItems: number) {
    super({ objectMode: true, highWaterMark: 100 }); // buffer 100 items
  }

  _read() {
    if (this.index >= this.maxItems) {
      this.push(null); // signal end
      return;
    }

    // .push() returns false when internal buffer is full (backpressure)
    while (this.index < this.maxItems && this.push({ id: this.index++, ts: Date.now() })) {
      // Keep pushing until buffer full or done
    }
  }
}

// Slow consumer that naturally creates backpressure
class SlowConsumer extends Writable {
  constructor(private name: string) {
    super({ objectMode: true, highWaterMark: 10 });
  }

  async _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    console.log(`[${this.name}] Processing item ${chunk.id}`);
    await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms per item
    callback();
  }
}

// Usage — pipeline automatically manages backpressure
const producer = new DataProducer(1000);
const consumer = new SlowConsumer('processor');

pipeline(producer, consumer, (err) => {
  if (err) console.error('Pipeline error:', err);
  else console.log('Pipeline complete');
});
```

### HTTP 429 Backpressure

```typescript
// Express middleware for backpressure signaling
import { Request, Response, NextFunction } from 'express';

interface BackpressureConfig {
  maxQueueDepth: number;
  currentDepth: () => number; // callback to check current queue
  retryAfterSeconds: number;
}

export function backpressureMiddleware(config: BackpressureConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const depth = config.currentDepth();

    // Signal backpressure when queue is deep
    if (depth > config.maxQueueDepth) {
      res.setHeader('Retry-After', String(config.retryAfterSeconds));
      res.setHeader('X-Queue-Depth', String(depth));
      return res.status(503).json({
        error: 'Service temporarily overloaded',
        retryAfter: config.retryAfterSeconds,
        queueDepth: depth,
      });
    }

    next();
  };
}

// Usage
const requestQueue: Array<() => void> = [];

app.use(backpressureMiddleware({
  maxQueueDepth: 1000,
  currentDepth: () => requestQueue.length,
  retryAfterSeconds: 5,
}));
```

### Python — asyncio Backpressure

```python
import asyncio
from typing import AsyncIterator, TypeVar

T = TypeVar("T")


class BackpressureQueue:
    """Bounded queue that signals producer to slow down."""

    def __init__(self, maxsize: int = 100):
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=maxsize)

    async def produce(self, item: T) -> bool:
        """Returns False if producer should back off."""
        try:
            self._queue.put_nowait(item)
            return True
        except asyncio.QueueFull:
            return False

    async def consume(self) -> AsyncIterator[T]:
        while True:
            item = await self._queue.get()
            yield item
            self._queue.task_done()
```

### Common Pitfalls

- **Unbounded queues** → `new Queue(Infinity)` = OOM waiting to happen. Always cap.
- **Polling instead of signaling** → Producer polls "are you busy?" instead of consumer pushing demand. Use reactive streams or explicit signals.
- **Ignoring Retry-After** → Client sees 429 and retries immediately. The 429 includes `Retry-After` — clients must respect it.
- **Backpressure only at one layer** → App-level backpressure means nothing if the network layer (too many connections) or disk (I/O wait) is the bottleneck.

### Verification

```bash
# Send requests at 2x normal rate
# Confirm 503 responses after queue depth threshold
# Confirm Retry-After header is present in 503s
# Confirm client respects backpressure and retries later
```

**Metrics**: `queue_depth_current`, `backpressure_429_sent_total`, `queue_dropped_total`

---

## 8. RATE LIMITING

### Problem

A single user or IP overwhelms the system. Without rate limiting,
one abusive client can degrade the experience for everyone.

### Token Bucket vs Leaky Bucket

| Pattern | Behavior | Use Case |
|---------|----------|----------|
| **Token Bucket** | Accumulates tokens (up to burst). Consumes per request. Refills at fixed rate. | Bursty traffic that averages to a limit |
| **Leaky Bucket** | Requests drip through at fixed rate. Excess is queued or dropped. | Steady-paced processing, database writes |
| **Fixed Window** | Count per clock window. Simple but allows bursting at boundary. | Simple per-user limits |
| **Sliding Window** | Precise rolling window. Uses Redis sorted sets. | Accurate rate limiting |

### Node.js — Token Bucket with Redis

```typescript
import { createClient, RedisClientType } from 'redis';
import { randomUUID } from 'node:crypto';

interface RateLimitConfig {
  redis: RedisClientType;
  points: number;        // max requests
  duration: number;      // window in seconds
  blockDuration?: number; // block duration after exceeding (seconds)
}

export class TokenBucketLimiter {
  private redis: RedisClientType;

  constructor(private config: RateLimitConfig) {
    this.redis = config.redis;
  }

  async consume(key: string, cost: number = 1): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
    const now = Date.now();
    const windowKey = `rate_limit:${key}`;
    const windowMs = this.config.duration * 1000;

    // Lua script for atomic token bucket
    const script = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local window_ms = tonumber(ARGV[2])
      local max_points = tonumber(ARGV[3])
      local cost = tonumber(ARGV[4])

      local data = redis.call('hmget', key, 'tokens', 'last_refill')
      local tokens = tonumber(data[1]) or max_points
      local last_refill = tonumber(data[2]) or now

      -- Refill tokens
      local elapsed = now - last_refill
      local refill = math.floor(elapsed * max_points / window_ms)
      if refill > 0 then
        tokens = math.min(max_points, tokens + refill)
        last_refill = now
      end

      -- Consume
      local allowed = 0
      if tokens >= cost then
        tokens = tokens - cost
        allowed = 1
      end

      redis.call('hmset', key, 'tokens', tokens, 'last_refill', last_refill)
      redis.call('pexpire', key, window_ms)  -- auto-cleanup

      return {allowed, tokens, window_ms - (now - last_refill)}
    `;

    const result = await this.redis.eval(script, {
      keys: [windowKey],
      arguments: [String(now), String(windowMs), String(this.config.points), String(cost)],
    }) as [number, number, number];

    return {
      allowed: result[0] === 1,
      remaining: result[1],
      resetMs: result[2],
    };
  }
}

// Express middleware
export function rateLimitMiddleware(limiter: TokenBucketLimiter, keyFn?: (req: any) => string) {
  return async (req: any, res: any, next: any) => {
    const key = keyFn ? keyFn(req) : `ip:${req.ip}`;
    const result = await limiter.consume(key);

    // Set standard headers
    res.setHeader('X-RateLimit-Limit', result.remaining);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetMs / 1000));

    if (!result.allowed) {
      const retryAfter = Math.ceil(result.resetMs / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter,
      });
    }

    next();
  };
}

// Usage
const redisClient = createClient({ url: process.env.REDIS_URL });
const limiter = new TokenBucketLimiter({
  redis: redisClient,
  points: 100,           // 100 requests
  duration: 60,          // per 60 seconds
});

// Per-IP limit
app.use('/api', rateLimitMiddleware(limiter));

// Per-user limit (API key based)
const userLimiter = rateLimitMiddleware(limiter, (req) => `user:${req.userId}`);
app.use('/api/orders', userLimiter);
```

### Python — Sliding Window with Redis

```python
import time
import redis.asyncio as aioredis


class SlidingWindowRateLimiter:
    """Sliding window rate limiter using Redis sorted sets."""

    def __init__(self, redis: aioredis.Redis, max_requests: int, window_seconds: int):
        self.redis = redis
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def check(self, key: str) -> tuple[bool, int, int]:
        """Returns (allowed, remaining, reset_seconds)."""
        now = time.monotonic()
        window_start = now - self.window_seconds
        redis_key = f"sliding:{key}"

        # Remove old entries outside window
        await self.redis.zremrangebyscore(redis_key, "-inf", window_start)

        # Count current requests
        count = await self.redis.zcard(redis_key)

        if count >= self.max_requests:
            # Get the oldest timestamp for Retry-After
            oldest = await self.redis.zrange(redis_key, 0, 0, withscores=True)
            reset_in = int((oldest[0][1] + self.window_seconds) - now) if oldest else 0
            return False, 0, max(1, reset_in)

        # Add current request
        await self.redis.zadd(redis_key, {str(now): now})
        await self.redis.expire(redis_key, self.window_seconds)

        return True, self.max_requests - count - 1, int(self.window_seconds - (now - window_start))
```

### Rate Limit Headers Standard

```
X-RateLimit-Limit: 100         # Max requests per window
X-RateLimit-Remaining: 87      # Remaining in current window
X-RateLimit-Reset: 1620000000  # Unix timestamp when window resets
Retry-After: 45                # Seconds to wait (only on 429)
```

### Distributed Rate Limiting

```typescript
// Redis-based distributed counter (fixed window — simpler but less precise)
export class DistributedFixedWindowLimiter {
  async consume(key: string, maxRequests: number, windowSec: number): Promise<boolean> {
    const redisKey = `fixed:${key}:${Math.floor(Date.now() / (windowSec * 1000))}`;

    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowSec * 1000);
    }

    return count <= maxRequests;
  }
}
```

### Common Pitfalls

- **Global rate limit, no per-user limit** → One user's burst blocks everyone. Always layer per-user + per-IP limits.
- **Rate limiting after expensive operations** → Check the rate limit BEFORE processing. Wasteful to compute and then reject.
- **Rate limit headers inconsistent** → Clients rely on `X-RateLimit-Remaining`. If it resets mid-window, clients can't calculate. Standardize.
- **Not rate limiting internal services** → Service-to-service calls bypass external limits. Internal rate limits prevent cascading failure.
- **Rate limit too generous for burst pattern** → User sends 100 requests in 1 second, then waits 60. Token bucket handles this; fixed window doesn't.

### Verification

```bash
# Send requests at rapid pace
for i in $(seq 1 120); do
  curl -s -o /dev/null -w "%{http_code} " http://localhost:4000/api;
done
# Expect: first 100 → 200, next 20 → 429

# Verify headers
curl -s -D - http://localhost:4000/api 2>&1 | grep -i rate
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 99
```

**Metrics**: `rate_limit_hits_total{key,limit}`, `rate_limit_blocked_total{key}`, `rate_limit_remaining{key}`

---

## 9. GRACEFUL DEGRADATION

### Problem

A dependency fails and the entire feature breaks. Graceful
degradation means the system still works — possibly with reduced
functionality, stale data, or simplified UI — instead of crashing.

### Degradation Tiers

```
TIER 1 (Full)       — All dependencies healthy. Full feature set.
TIER 2 (Degraded)   — Non-critical dependency down. Show stale cache, disable secondary features.
TIER 3 (Minimal)    — Critical dependency down. Serve static fallback, read-only mode.
TIER 4 (Outage)     — Catastrophic. Maintenance page or redirect.
```

### Node.js Implementation

```typescript
interface DegradationConfig {
  /** Dependency name for monitoring */
  name: string;
  /** Health check function */
  check: () => Promise<boolean>;
  /** Cache fallback — used when dependency is unhealthy */
  cacheFallback?: () => Promise<unknown>;
  /** Whether this dependency is critical */
  critical: boolean;
  /** Grace period (ms) before degrading after failure */
  gracePeriodMs?: number;
}

type DegradationTier = 1 | 2 | 3 | 4;

class GracefulDegradationManager {
  private serviceStatus: Map<string, { healthy: boolean; lastFailure: number }> = new Map();
  private listeners: Array<(tier: DegradationTier) => void> = [];

  constructor(private configs: DegradationConfig[]) {}

  async checkAll(): Promise<DegradationTier> {
    let worstTier: DegradationTier = 1;

    for (const config of this.configs) {
      const statusRecord = this.serviceStatus.get(config.name) ?? { healthy: true, lastFailure: 0 };
      let healthy: boolean;

      try {
        healthy = await config.check();
      } catch {
        healthy = false;
      }

      if (!healthy) {
        statusRecord.lastFailure = Date.now();
      }
      statusRecord.healthy = healthy;
      this.serviceStatus.set(config.name, statusRecord);

      const tier = this.calculateTier(config, statusRecord);
      if (tier > worstTier) worstTier = tier;
    }

    this.listeners.forEach((fn) => fn(worstTier));
    return worstTier;
  }

  private calculateTier(config: DegradationConfig, status: { healthy: boolean; lastFailure: number }): DegradationTier {
    if (status.healthy) return 1;

    const downDuration = Date.now() - status.lastFailure;
    const inGracePeriod = downDuration < (config.gracePeriodMs ?? 5000);

    if (config.critical) {
      if (inGracePeriod) return 2; // degraded but give it a moment
      return 4; // critical = outage
    }

    if (inGracePeriod) return 1; // ignore brief non-critical failures
    return 3; // non-critical degraded
  }

  onDegrade(fn: (tier: DegradationTier) => void) {
    this.listeners.push(fn);
  }

  getServiceStatus(name: string) {
    return this.serviceStatus.get(name);
  }

  getAllStatus() {
    return Object.fromEntries(this.serviceStatus);
  }
}

// Usage
const degradation = new GracefulDegradationManager([
  {
    name: 'payment-gateway',
    check: async () => { /* health check */ return true; },
    critical: true,
    gracePeriodMs: 5000,
    cacheFallback: async () => ({ cached: true, status: 'unavailable' }),
  },
  {
    name: 'recommendation-engine',
    check: async () => { /* health check */ return true; },
    critical: false,
    cacheFallback: async () => ({ cached: true, recommendations: [] }),
  },
]);

// Express middleware
app.get('/api/products', async (req, res) => {
  const tier = await degradation.checkAll();

  switch (tier) {
    case 1:
      // Full response — all services healthy
      return res.json(await getProducts());
    case 2:
    case 3:
      // Degraded — serve from cache
      return res.json({
        data: await getCachedProducts(),
        degraded: true,
        staleAt: cachedAt,
      });
    case 4:
      // Outage — minimal response
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        retryAfter: 30,
      });
  }
});
```

### Python Implementation

```python
from enum import IntEnum
from dataclasses import dataclass
from typing import Any, Callable, Optional


class DegradationTier(IntEnum):
    FULL = 1
    DEGRADED = 2
    MINIMAL = 3
    OUTAGE = 4


@dataclass
class ServiceDependency:
    name: str
    check: Callable[[], bool]
    critical: bool = False
    grace_period_s: float = 5.0
    cache_fallback: Optional[Callable[[], Any]] = None


class DegradationManager:
    def __init__(self):
        self._services: dict[str, ServiceDependency] = {}
        self._status: dict[str, dict] = {}
        self._tier_listeners: list[Callable] = []

    def register(self, dep: ServiceDependency):
        self._services[dep.name] = dep
        self._status[dep.name] = {"healthy": True, "last_failure": 0.0}

    async def check_all(self) -> DegradationTier:
        import time
        worst = DegradationTier.FULL

        for name, dep in self._services.items():
            status = self._status[name]
            try:
                healthy = dep.check()
            except Exception:
                healthy = False

            if not healthy:
                status["last_failure"] = time.monotonic()
            status["healthy"] = healthy

            # Calculate tier
            if not healthy:
                down_for = time.monotonic() - status["last_failure"]
                in_grace = down_for < dep.grace_period_s

                if dep.critical:
                    worst = max(worst, DegradationTier.OUTAGE if not in_grace else DegradationTier.DEGRADED)
                elif not in_grace:
                    worst = max(worst, DegradationTier.MINIMAL)

        for listener in self._tier_listeners:
            listener(worst)

        return worst

    def get_fallback(self, name: str) -> Any:
        dep = self._services.get(name)
        if dep and dep.cache_fallback:
            return dep.cache_fallback()
        return None
```

### Degraded Mode Testing

```typescript
// Force degradation for testing
export async function forceDegradation(
  manager: GracefulDegradationManager,
  serviceName: string,
  healthy: boolean,
) {
  // Override the health check for testing
  const status = manager.getServiceStatus(serviceName);
  if (status) {
    Object.assign(status, { healthy, lastFailure: healthy ? 0 : Date.now() });
  }
}

// Test: force non-critical dependency to fail, confirm tier 3
// Test: force critical dependency to fail, confirm tier 4 after grace period
```

### Common Pitfalls

- **No cache for fallbacks** → Degradation returns errors instead of stale data. Always prepare a cache fallback.
- **Degradation without user communication** → Users see a broken feature. Show a clear banner: "This feature is temporarily degraded."
- **Not testing degraded mode** → Degradation code is never exercised until production breaks. Test it regularly.
- **All services marked critical** → Any failure = full outage. Be honest about what's truly critical.

### Verification

```bash
# Stop payment service
# Confirm product listing still works (degraded, shows cached data)
# Confirm checkout returns clear error, not a crash
# Confirm monitoring shows degradation tier change
```

**Metrics**: `degradation_tier{gauge}`, `degraded_requests_total{service}`

---

## 10. HEALTH CHECKS

### Problem

Orchestrators (K8s), load balancers, and monitors need to know
if the service is alive and ready to serve traffic. Without
proper health checks, they send traffic to dead or overloaded
instances.

### Liveness vs Readiness

| Check | Purpose | Failure Action |
|-------|---------|---------------|
| **Liveness** | Is the process alive? (not deadlocked, not hung) | Restart container |
| **Readiness** | Can the process serve traffic? (deps ready, cache warm) | Remove from service |
| **Startup** | Has the process finished initializing? | Delay liveness checks |

### Node.js — Health Check Endpoint

```typescript
import { Router } from 'express';

interface HealthCheck {
  name: string;
  check: () => Promise<{ healthy: boolean; detail?: string }>;
  critical: boolean;
  timeoutMs?: number;
}

export function createHealthRouter(checks: HealthCheck[]) {
  const router = Router();

  // /health — liveness (is process alive?)
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // /ready — readiness (can we serve traffic?)
  router.get('/ready', async (_req, res) => {
    const results = await Promise.allSettled(
      checks.map(async (check) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), check.timeoutMs ?? 3000);

        try {
          const result = await check.check();
          return { ...result, name: check.name };
        } finally {
          clearTimeout(timer);
        }
      }),
    );

    const healthy: any[] = [];
    const unhealthy: any[] = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        if (result.value.healthy) healthy.push(result.value);
        else unhealthy.push(result.value);
      } else {
        unhealthy.push({ name: 'unknown', healthy: false, detail: result.reason?.message });
      }
    });

    const criticalUnhealthy = unhealthy.filter(
      (u) => checks.find((c) => c.name === u.name)?.critical,
    );

    const overall = criticalUnhealthy.length === 0;
    const statusCode = overall ? 200 : 503;

    res.status(statusCode).json({
      status: overall ? 'ok' : 'degraded',
      healthy: overall ? healthy.length : healthy,
      unhealthy: unhealthy.map((u) => ({ name: u.name, detail: u.detail })),
      checks: overall
        ? undefined
        : [...healthy.map((h) => ({ name: h.name, status: 'ok' })),
           ...unhealthy.map((u) => ({ name: u.name, status: 'fail', detail: u.detail }))],
      timestamp: new Date().toISOString(),
    });
  });

  // /startup — startup probe
  let startupComplete = false;
  router.get('/startup', (_req, res) => {
    if (startupComplete) {
      return res.json({ status: 'ok' });
    }
    res.status(503).json({ status: 'starting' });
  });

  function markStartupComplete() {
    startupComplete = true;
  }

  return { router, markStartupComplete };
}

// Example checks
const checks: HealthCheck[] = [
  {
    name: 'postgres',
    critical: true,
    check: async () => {
      await db.raw('SELECT 1');
      return { healthy: true };
    },
  },
  {
    name: 'redis',
    critical: true,
    check: async () => {
      await redis.ping();
      return { healthy: true };
    },
  },
  {
    name: 'payment-api',
    critical: false,
    check: async () => {
      const response = await fetch('https://api.payment.com/health');
      return { healthy: response.ok, detail: response.ok ? undefined : `status ${response.status}` };
    },
  },
];

const { router: healthRouter, markStartupComplete } = createHealthRouter(checks);
app.use(healthRouter);

// Mark startup complete after initialization
await initializeApp();
markStartupComplete();
```

### Python — FastAPI Health Endpoints

```python
import time
from fastapi import APIRouter, Response
from dataclasses import dataclass, field
from typing import Optional

router = APIRouter()

_startup_time = time.monotonic()


@dataclass
class DependencyCheck:
    name: str
    critical: bool = True
    timeout_s: float = 5.0
    check_fn: callable = lambda: True


_registered_checks: list[DependencyCheck] = []


def register_check(check: DependencyCheck):
    _registered_checks.append(check)


@router.get("/health")
async def liveness():
    """Liveness probe — is the process alive?"""
    return {"status": "ok", "uptime": time.monotonic() - _startup_time}


@router.get("/ready")
async def readiness(response: Response):
    """Readiness probe — can we serve traffic?"""
    results = []
    overall_healthy = True

    for check in _registered_checks:
        try:
            import asyncio
            healthy = await asyncio.wait_for(
                asyncio.to_thread(check.check_fn), timeout=check.timeout_s
            )
            if not healthy and check.critical:
                overall_healthy = False
            results.append({
                "name": check.name,
                "healthy": healthy,
            })
        except Exception as e:
            if check.critical:
                overall_healthy = False
            results.append({
                "name": check.name,
                "healthy": False,
                "detail": str(e),
            })

    response.status_code = 200 if overall_healthy else 503
    return {
        "status": "ok" if overall_healthy else "degraded",
        "healthy": sum(1 for r in results if r["healthy"]),
        "unhealthy": [r for r in results if not r["healthy"]],
        "checks": results,
    }


@router.get("/startup")
async def startup():
    """Startup probe."""
    elapsed = time.monotonic() - _startup_time
    if elapsed < 10:  # 10s startup window
        return {"status": "starting", "elapsed": elapsed}
    return {"status": "ok"}
```

### Kubernetes Probe Config

```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          image: myapp:latest
          ports:
            - containerPort: 3000
          startupProbe:
            httpGet:
              path: /startup
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 5
            failureThreshold: 30    # 30 * 5 = 150s max startup
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 15
            timeoutSeconds: 3
            failureThreshold: 3     # 45s of failures → restart
          readinessProbe:
            httpGet:
              path: /ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
            timeoutSeconds: 3
            failureThreshold: 2     # 20s of failures → remove from service
```

### Common Pitfalls

- **Liveness and readiness use the same check** → Process hangs but dependencies are fine. Readiness should fail BEFORE liveness.
- **Health checks with auth** → Probes can't authenticate. Exclude health endpoints from auth middleware.
- **External dependencies in liveness** → If DB is down, K8s restarts the pod. But restarting won't fix the DB. Use liveness for process health only.
- **Probe timeout too short** → 1s timeout for a DB check during load spike. Set 3-5s timeout.
- **No startup probe** → App takes 30s to warm cache. Liveness kills it before it starts.

### Verification

```bash
# Liveness (should always be 200)
curl http://localhost:3000/health

# Readiness with all deps up
curl http://localhost:3000/ready
# {"status":"ok","healthy":3,"unhealthy":[]}

# Readiness with DB down
# {"status":"degraded","healthy":2,"unhealthy":[{"name":"postgres","detail":"...",}]}
# (HTTP 503)

# Startup probe during initialization
curl http://localhost:3000/startup
# {"status":"ok"} or {"status":"starting"}
```

**Metrics**: `health_check_total{name,status}`, `health_check_duration_ms{name}`, `uptime_seconds`

---

## 11. RACE CONDITIONS / DEADLOCKS

### Problem

Two concurrent operations conflict on shared state, producing
corrupt data (race condition) or each waiting on the other's
lock (deadlock). Without handling these, data integrity
collapses under concurrency.

### Race Condition Detection

```typescript
// Pattern: Check-then-act race
// BAD: Two concurrent requests both pass the check
async function badDeductBalance(userId: string, amount: number) {
  const balance = await db.getBalance(userId);
  if (balance >= amount) {
    // RACE: another request may deduct between check and update
    await db.deductBalance(userId, amount);
    return true;
  }
  return false;
}

// GOOD: Atomic operation
async function goodDeductBalance(userId: string, amount: number) {
  const updated = await db.raw(`
    UPDATE balances
    SET balance = balance - ?
    WHERE user_id = ?
      AND balance >= ?
  `, [amount, userId, amount]);
  return updated.rowCount > 0;
}
```

### Deadlock Detection

```typescript
// PostgreSQL deadlock detection
async function detectDeadlocks() {
  const result = await db.raw(`
    SELECT
      blocked_locks.pid AS blocked_pid,
      blocked_activity.query AS blocked_query,
      blocking_locks.pid AS blocking_pid,
      blocking_activity.query AS blocking_query
    FROM pg_catalog.pg_locks blocked_locks
    JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_locks.pid = blocked_activity.pid
    JOIN pg_catalog.pg_locks blocking_locks
      ON blocking_locks.locktype = blocked_locks.locktype
      AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
      AND blocking_locks.relation IS NOT DISTINCT FROM blocked_blocks.relation
      AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
      AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
      AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
      AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
      AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
      AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
      AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
      AND blocking_locks.pid != blocked_locks.pid
    JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_locks.pid = blocking_activity.pid
    WHERE NOT blocked_locks.granted
  `);

  if (result.rows.length > 0) {
    console.error('Deadlock detected:', result.rows);
  }
  return result.rows;
}
```

### Deadlock Prevention Strategies

1. **Consistent lock ordering**: Always acquire locks in the same global order (e.g., by resource ID ascending).
2. **Lock timeout**: Use `SET lock_timeout = '5s'` in PostgreSQL so a deadlock fails fast instead of hanging.
3. **Keep transactions short**: The longer a transaction holds locks, the higher the deadlock probability.
4. **Use lock timeouts**: PostgreSQL deadlock detection kicks in after a timeout. Set reasonable timeout.
5. **Deadlock retry**: Catch deadlock errors and retry the transaction.

```typescript
// Consistent lock ordering — always lock in ID order
async function transferFunds(fromId: string, toId: string, amount: number) {
  // Prevent deadlock by always locking in consistent order
  const [first, second] = fromId < toId
    ? [fromId, toId]
    : [toId, fromId];

  const trx = await db.transaction();
  try {
    // Lock accounts in order
    await trx('accounts').where('id', first).forUpdate().first();
    await trx('accounts').where('id', second).forUpdate().first();

    await trx('accounts').where('id', fromId).decrement('balance', amount);
    await trx('accounts').where('id', toId).increment('balance', amount);
    await trx.commit();
  } catch (err) {
    await trx.rollback();
    if ((err as any).code === '40001') { // serialization failure / deadlock
      // Retry once
      return transferFunds(fromId, toId, amount);
    }
    throw err;
  }
}
```

### Python — Deadlock Detection & Retry

```python
import time
import asyncio
from functools import wraps
from typing import Callable

DEADLOCK_RETRYABLE_CODES = {"40001", "40P01"}  # PostgreSQL


def retry_on_deadlock(max_retries: int = 3, base_delay: float = 0.1):
    """Decorator that retries on deadlock detection."""
    def decorator(fn: Callable):
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            last_exc = None
            for attempt in range(max_retries):
                try:
                    return await fn(*args, **kwargs)
                except Exception as exc:
                    code = getattr(exc, "pgcode", "") or getattr(exc, "code", "")
                    if code not in DEADLOCK_RETRYABLE_CODES:
                        raise
                    last_exc = exc
                    delay = base_delay * (2 ** attempt) + (0.01 * (attempt ** 2))
                    print(f"[deadlock-retry] attempt {attempt + 1}, waiting {delay:.2f}s")
                    await asyncio.sleep(delay)
            raise last_exc
        return wrapper
    return decorator
```

### Common Pitfalls

- **No lock timeout** → A deadlocked transaction waits forever (or until pg's `deadlock_timeout` which defaults to 1s). Set explicit lock timeouts.
- **Inconsistent lock ordering** → Transaction A locks accounts in order (1, 2), transaction B locks (2, 1). Deadlock guaranteed.
- **Implicit locks from foreign keys** → Updating a parent table may lock child tables. Understand your ORM's locking behavior.
- **Read-modify-write without locking** → Classic race condition. Use `SELECT ... FOR UPDATE` or optimistic locking.

### Verification

```bash
# Race condition test: two simultaneous writes
# Launch concurrent requests, verify no inconsistent data

# Deadlock test: two transactions in opposite order
# Session 1: BEGIN; UPDATE accounts SET balance=balance-10 WHERE id=1; --wait--
# Session 2: BEGIN; UPDATE accounts SET balance=balance-10 WHERE id=2;
# Session 2: UPDATE accounts SET balance=balance+10 WHERE id=1; --DEADLOCK--
```

**Metrics**: `deadlock_detected_total`, `race_condition_retry_total`

---

## 12. OPTIMISTIC VS PESSIMISTIC LOCKING

### Problem

Concurrent writes can overwrite each other. The locking strategy
determines how you handle the conflict.

| Locking | When to Use | Concurrency | Performance |
|---------|-------------|-------------|-------------|
| **Optimistic** | Low contention, rare conflicts | Highest | Best (no locks held) |
| **Pessimistic** | High contention, frequent conflicts | Low | Can degrade (locks held) |

### Optimistic Locking (Version-Based)

```typescript
// Schema: add version column to tables
// ALTER TABLE products ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

interface Product {
  id: string;
  name: string;
  price: number;
  version: number;
}

async function updateProduct(
  id: string,
  updates: Partial<Product>,
  expectedVersion: number,
): Promise<Product> {
  const result = await db('products')
    .where({ id, version: expectedVersion })
    .update({
      ...updates,
      version: expectedVersion + 1,
    })
    .returning('*');

  if (result.length === 0) {
    // Someone else modified the record
    throw new OptimisticLockError(`Product ${id} was modified by another transaction`);
  }

  return result[0];
}

class OptimisticLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OptimisticLockError';
  }
}

// Retry logic for optimistic lock failures
async function updateWithRetry(
  id: string,
  updater: (current: Product) => Promise<Partial<Product>>,
  maxRetries = 3,
): Promise<Product> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // 1. Read current state (with version)
    const product = await db('products').where({ id }).first();
    if (!product) throw new Error('Not found');

    // 2. Apply update
    const changes = await updater(product);

    try {
      return await updateProduct(id, changes, product.version);
    } catch (err) {
      if (err instanceof OptimisticLockError && attempt < maxRetries - 1) {
        continue; // retry with fresh data
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Pessimistic Locking (Row-Level)

```typescript
// SELECT ... FOR UPDATE — locks the row until transaction commits

async function deductInventory(productId: string, quantity: number) {
  const trx = await db.transaction();
  try {
    // Lock the row — other transactions wait
    const product = await trx('inventory')
      .where({ product_id: productId })
      .forUpdate()          // <-- pessimistic lock
      .first();

    if (!product || product.quantity < quantity) {
      throw new Error('Insufficient inventory');
    }

    await trx('inventory')
      .where({ product_id: productId })
      .decrement('quantity', quantity);

    await trx.commit();
  } catch (err) {
    await trx.rollback();
    throw err;
  }
}

// SELECT ... FOR UPDATE SKIP LOCKED — skip locked rows (queue-style processing)
async function claimNextJob() {
  const job = await db('jobs')
    .where({ status: 'pending' })
    .orderBy('priority', 'desc')
    .orderBy('created_at', 'asc')
    .forUpdate()
    .skipLocked()  // <-- skip rows locked by other workers
    .first();

  if (job) {
    await db('jobs').where({ id: job.id }).update({ status: 'processing' });
  }

  return job;
}
```

### When to Use Which

| Scenario | Locking | Why |
|----------|---------|-----|
| **Inventory deduction** | Pessimistic | Two users buying last item — must prevent overselling |
| **User profile update** | Optimistic | Rare conflicts. Let the last writer retry |
| **Financial transfer** | Pessimistic | Must prevent race conditions on balance |
| **Analytics counter** | Optimistic (atomic incr) | `UPDATE SET count = count + 1` |
| **Job queue worker** | Pessimistic (SKIP LOCKED) | Multiple workers must not pick same job |
| **CMS document edit** | Optimistic | Warn user "someone else edited this" |

### Common Pitfalls

- **Optimistic locking with high contention** → Most transactions fail and retry, wasting resources. Use pessimistic locking.
- **Pessimistic locking without short transactions** → Locks held for 10+ seconds. Other operations queue up. Keep locked transactions under 200ms.
- **`SELECT ... FOR UPDATE` without index** → Locks the entire table instead of the row. Ensure the WHERE clause uses an indexed column.
- **Not handling optimistic lock failures** → The error is thrown but not retried. Always implement retry.

### Verification

```bash
# Optimistic: two concurrent updates to same record
# Second one should fail with "version mismatch"
# Confirm retry succeeds on subsequent attempt

# Pessimistic: start transaction, hold lock, concurrent read waits
# Session 1: BEGIN; SELECT * FROM inventory WHERE id=1 FOR UPDATE; --don't commit--
# Session 2: BEGIN; SELECT * FROM inventory WHERE id=1 FOR UPDATE; --BLOCKED--
# Session 1: COMMIT; --Session 2 unblocks--
```

**Metrics**: `optimistic_lock_retries_total`, `optimistic_lock_failures_total`, `pessimistic_lock_wait_ms`

---

## 13. DISTRIBUTED LOCKS

### Problem

Multiple service instances need to coordinate on shared
resources (cron jobs, cache refresh, inventory). A local lock
won't work across processes.

### Redis Redlock

```typescript
import { createClient } from 'redis';

interface LockOptions {
  /** Lock key in Redis */
  resource: string;
  /** TTL in ms — lock auto-releases after this */
  ttlMs: number;
  /** Retry delay if lock acquisition fails */
  retryDelayMs?: number;
  /** Max retries (0 = fail immediately) */
  maxRetries?: number;
}

interface DistributedLock {
  /** Unique lock token for safe release */
  value: string;
  /** Lock key */
  resource: string;
}

export class RedisDistributedLock {
  constructor(private redis: ReturnType<typeof createClient>) {}

  async acquire(options: LockOptions): Promise<DistributedLock | null> {
    const {
      resource,
      ttlMs,
      retryDelayMs = 50,
      maxRetries = 10,
    } = options;

    const lockKey = `lock:${resource}`;
    const lockValue = randomUUID(); // unique per attempt

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // SET NX PX — atomic lock acquisition
      const acquired = await this.redis.set(lockKey, lockValue, {
        NX: true,
        PX: ttlMs,
      });

      if (acquired === 'OK') {
        return { value: lockValue, resource: lockKey };
      }

      if (attempt < maxRetries) {
        await sleep(retryDelayMs + Math.random() * retryDelayMs);
      }
    }

    return null; // could not acquire lock
  }

  async release(lock: DistributedLock): Promise<boolean> {
    // Lua script ensures we only delete OUR lock (safe release)
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, {
      keys: [lock.resource],
      arguments: [lock.value],
    });

    return result === 1;
  }

  // Execute code under lock
  async withLock<T>(
    resource: string,
    ttlMs: number,
    fn: () => Promise<T>,
    options?: Partial<LockOptions>,
  ): Promise<T> {
    const lock = await this.acquire({ resource, ttlMs, ...options });
    if (!lock) {
      throw new Error(`Could not acquire lock for resource: ${resource}`);
    }

    try {
      return await fn();
    } finally {
      await this.release(lock).catch((err) => {
        console.error('Failed to release lock:', err);
      });
    }
  }
}

// Usage
const lockClient = new RedisDistributedLock(redisClient);

// Scheduled job that only runs on one instance
await lockClient.withLock('cron:send-emails', 30000, async () => {
  const batch = await getPendingEmails();
  for (const email of batch) {
    await sendEmail(email);
  }
});
```

### Python — Redlock Implementation

```python
import uuid
import time
import asyncio
from typing import Optional

import redis.asyncio as aioredis


class DistributedLock:
    """Distributed lock via Redis (single-node — use aioredlock for multi-node)."""

    def __init__(self, redis: aioredis.Redis):
        self.redis = redis

    async def acquire(
        self,
        resource: str,
        ttl_ms: int = 30000,
        retry_delay_ms: int = 100,
        max_retries: int = 10,
    ) -> Optional[dict]:
        lock_key = f"lock:{resource}"
        lock_value = str(uuid.uuid4())

        for attempt in range(max_retries + 1):
            acquired = await self.redis.set(
                lock_key, lock_value, nx=True, px=ttl_ms
            )
            if acquired:
                return {"resource": lock_key, "value": lock_value}

            if attempt < max_retries:
                await asyncio.sleep((retry_delay_ms + (attempt * 10)) / 1000)

        return None

    async def release(self, lock: dict) -> bool:
        """Safe release — only deletes if value matches."""
        script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            end
            return 0
        """
        result = await self.redis.eval(script, 1, lock["resource"], lock["value"])
        return result == 1

    async def with_lock(self, resource: str, ttl_ms: int, fn, **kwargs):
        lock = await self.acquire(resource, ttl_ms, **kwargs)
        if not lock:
            raise RuntimeError(f"Could not acquire lock: {resource}")
        try:
            return await fn()
        finally:
            await self.release(lock)
```

### Fencing Tokens

A fencing token prevents delayed lock holders from writing stale data.

```typescript
// After acquiring lock, increment a monotonic token
// Every write includes the token. Storage rejects stale tokens.

class FencingTokenManager {
  async acquireFencingToken(resource: string): Promise<number> {
    // Atomic increment — guaranteed monotonic
    return await redis.incr(`fencing:${resource}`);
  }
}

// Writer uses fencing token
async function writeWithFencing(resource: string, data: unknown) {
  const lock = await distributedLock.acquire({ resource, ttlMs: 5000 });
  if (!lock) throw new Error('Could not acquire lock');

  const token = await fencingManager.acquireFencingToken(resource);

  try {
    // Storage layer checks: if token <= last_seen_token, reject
    await storage.writeWithToken(resource, data, token);
  } finally {
    await distributedLock.release(lock);
  }
}
```

### Lock Lease Renewal

```typescript
// Background renewal to handle long-running critical sections
class LeaseRenewer {
  private renewalTimer: ReturnType<typeof setInterval> | null = null;

  start(lock: DistributedLock, ttlMs: number, renewThresholdMs: number) {
    // Renew at 2/3 of TTL
    const intervalMs = ttlMs - renewThresholdMs;

    this.renewalTimer = setInterval(async () => {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        end
        return 0
      `;
      const renewed = await redis.eval(script, {
        keys: [lock.resource],
        arguments: [lock.value, String(ttlMs)],
      });

      if (renewed === 0) {
        // Lost lock — abort work
        this.stop();
        throw new Error('Lost distributed lock lease');
      }
    }, intervalMs);
  }

  stop() {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
      this.renewalTimer = null;
    }
  }
}
```

### Common Pitfalls

- **Not using fencing tokens** → A delayed lock holder wakes up and writes stale data. The next lock holder's write gets clobbered.
- **No lease renewal** → Long-running operation under a short TTL. Lock expires, another instance picks it up, both write.
- **Clock drift with Redlock** → Redlock assumes synchronized clocks. If Node A's clock is 10s behind Node B's, lock timing breaks. Use monotonic clocks.
- **Lock not released on crash** → Always set TTL. If process crashes mid-operation, lock auto-releases.
- **Synchronous I/O under lock** → Holding a lock while doing a 5s HTTP call. Use short TTLs and keep locked work minimal.

### Verification

```bash
# Two concurrent lock attempts — only one succeeds
# Launch two scripts simultaneously, confirm only one acquires lock

# Lock auto-release after TTL
# Acquire lock, wait for TTL, confirm second attempt succeeds

# Safe release — second process can't release first's lock
# Acquire lock with value-A, try to release with value-B -> fails
```

**Metrics**: `distributed_lock_acquire_total{resource,result}`, `distributed_lock_lease_renewed_total{resource}`, `distributed_lock_held_ms{resource}`

---

## RESILIENCE TESTING CHECKLIST

Before declaring a system production-ready, verify each pattern:

### Circuit Breaker
- [ ] Circuit opens after N consecutive failures
- [ ] Circuit resets after recovery timeout (half-open probe)
- [ ] Fallback response served when circuit is open
- [ ] Metrics emitted for circuit state transitions
- [ ] Alert configured on circuit open > 5 minutes

### Retries
- [ ] Retries limited to configurable max (3-5 typical)
- [ ] Exponential backoff with jitter implemented
- [ ] Non-retryable errors (4xx) are NOT retried
- [ ] Retry budget in place to prevent retry storms
- [ ] Idempotency key passed on retried POST/PUT/PATCH

### Timeouts
- [ ] Connect, read, and write timeouts configured per-service
- [ ] Deadline propagation implemented across service calls
- [ ] AbortController/signals properly cleaned up
- [ ] Timeout errors logged with correlation ID

### Idempotency
- [ ] All POST/PUT/PATCH endpoints require Idempotency-Key
- [ ] Duplicate requests return original response (status + body)
- [ ] "Processing" lock prevents concurrent duplicates
- [ ] TTL covers client max retry window (24h recommended)
- [ ] Idempotency tested with exact replay of the same request

### Dead Letter Queues
- [ ] Every consumer queue has a DLQ configured
- [ ] DLQ has finite retention (7-14 days)
- [ ] Alert fires on DLQ depth > 0 for > 5 minutes
- [ ] DLQ inspection dashboard or tooling exists
- [ ] Redrive mechanism available for reprocessing

### Bulkheads
- [ ] Each critical dependency has its own bulkhead (thread pool or semaphore)
- [ ] Queue limit is bounded (2-3x max concurrent)
- [ ] Metrics exposed for active, queued, rejected
- [ ] Bulkhead rejection is handled gracefully

### Backpressure
- [ ] All queues are bounded (size limit configured)
- [ ] 429/503 responses include Retry-After header
- [ ] Clients implement retry honoring Retry-After
- [ ] Stream consumers respect highWaterMark / buffering

### Rate Limiting
- [ ] Per-user and per-IP rate limits in place
- [ ] Rate limit checked BEFORE expensive operations
- [ ] Standard headers returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] Distributed rate limiting using Redis for multi-instance deployments
- [ ] Internal service-to-service rate limits configured

### Graceful Degradation
- [ ] Each non-critical dependency has a cache fallback
- [ ] Degradation tier propagated to frontend / API responses
- [ ] Degraded mode tested (simulate each dependency failure)
- [ ] Clear user-facing messaging when features are degraded
- [ ] Not all services marked as "critical"

### Health Checks
- [ ] `/health` endpoint (liveness) returns 200 OK
- [ ] `/ready` endpoint aggregates all dependency health
- [ ] `/ready` returns 503 when critical dependency is unhealthy
- [ ] Startup probe prevents premature liveness kills
- [ ] Health endpoints excluded from auth middleware
- [ ] K8s probes configured with appropriate thresholds

### Race Conditions / Deadlocks
- [ ] All check-then-act patterns use atomic operations
- [ ] Lock timeout configured for all DB transactions
- [ ] Deadlock retry logic implemented
- [ ] Consistent lock ordering across the codebase

### Optimistic / Pessimistic Locking
- [ ] Strategy chosen per use case (not one-size-fits-all)
- [ ] Optimistic: version column on all contended tables
- [ ] Optimistic: retry logic on version mismatch
- [ ] Pessimistic: `SELECT ... FOR UPDATE` with indexed WHERE
- [ ] Pessimistic: short transactions (< 200ms lock time)

### Distributed Locks
- [ ] Fencing tokens used for critical writes
- [ ] Lock TTL configured (with renewal for long operations)
- [ ] Safe release verifies lock ownership (Lua script)
- [ ] Clock drift accounted for (use monotonic time)
- [ ] Fallback if lock cannot be acquired

### General
- [ ] All resilience patterns emit metrics
- [ ] Dashboards created for each pattern
- [ ] Alerts configured on failure thresholds
- [ ] Chaos/toxiproxy tests run weekly
- [ ] Runbook documents failure scenarios and recovery steps
- [ ] Resilience patterns under version control (config as code)
