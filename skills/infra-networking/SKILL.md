# INFRA NETWORKING — Load Balancers, Reverse Proxies, CDN, TLS, WAF

## PURPOSE

Provides runnable config templates and production best practices
for every networking layer between the user and your application:
load balancers, reverse proxies, API gateways, DNS, CDN, TLS,
WebSocket proxying, gRPC passthrough, CORS, and WAF/DDoS protection.

## TRIGGERS

- "Set up a load balancer"
- "Configure Nginx reverse proxy"
- "Add rate limiting"
- "Set up API gateway (Kong / AWS)"
- "Configure DNS / Route53 / Cloudflare"
- "Set up CDN / CloudFront / edge caching"
- "Enable HTTP/2 or HTTP/3"
- "gRPC service setup"
- "WebSocket / SSE / long polling proxy"
- "WAF rules / DDoS protection"
- "TLS / SSL / certbot / Let's Encrypt / mTLS"
- "CORS configuration"
- "Any `infra-networking.skill.md` delegation from production-hardening"

---

## 1. LOAD BALANCERS

### Problem

A single server cannot handle all traffic. Load balancers distribute
requests across a pool of upstream servers, run health checks, terminate
TLS, and provide a fixed entry point that survives backend failures.

### 1.1 Nginx — Round-Robin with Health Checks

```nginx
upstream backend {
    # Least-connections usually beats round-robin for variable request times
    least_conn;

    server <app-server-1>:3000 max_fails=3 fail_timeout=30s;
    server <app-server-2>:3000 max_fails=3 fail_timeout=30s;
    server <app-server-3>:3000 backup;                   # cold spare

    # Optional: keep idle connections to upstream alive
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name <api.example.com>;

    ssl_certificate     /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;

    location / {
        proxy_pass  http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";                  # enable keepalive to upstream

        # Forward client metadata
        proxy_set_header Host                    $host;
        proxy_set_header X-Real-IP               $remote_addr;
        proxy_set_header X-Forwarded-For         $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto       $scheme;

        # Timeouts — DO NOT leave at defaults in production
        proxy_connect_timeout   5s;
        proxy_send_timeout      10s;
        proxy_read_timeout      30s;
    }
}
```

### 1.2 AWS ALB (Application Load Balancer)

Target group health check settings in Terraform:

```hcl
resource "aws_lb_target_group" "app" {
  name        = "<app-tg>"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 15
    timeout             = 5
    matcher             = "200-399"
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400                  # 1 day
    enabled         = true                   # only if sessions are stateful
  }

  deregistration_delay = 60
}
```

### 1.3 HAProxy — Advanced TCP/HTTP Load Balancer

```haproxy
global
    log  /dev/log local0
    maxconn  4096
    tune.ssl.default-dh-param 2048

defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    retries 3
    timeout connect     5s
    timeout client      30s
    timeout server      30s
    timeout http-keep-alive 10s

frontend www
    bind :443 ssl crt /etc/ssl/certs/<domain>.pem alpn h2,http/1.1
    default_backend app_servers

backend app_servers
    balance leastconn
    option httpchk GET /health HTTP/1.1\r\nHost:\ <domain>
    server app1 <app-server-1>:3000 check inter 5s fall 3 rise 2
    server app2 <app-server-2>:3000 check inter 5s fall 3 rise 2
    server app3 <app-server-3>:3000 check inter 5s fall 3 rise 2 backup
```

### Common Pitfalls

- **Single point of LB failure** — always run ≥2 LB instances (ALB is regional; Nginx needs keepalived or DNS failover)
- **Health check path returns 200 but app is broken** — health checks should verify DB connectivity, not just return a static "ok"
- **Sticky sessions enabled when stateless** — stickiness kills rolling deployments; prefer stateless apps and disable stickiness
- **Timeout too long** — hides slow upstreams; set proxy_read_timeout ≤30s unless streaming
- **Connection draining too short** — set deregistration_delay ≥60s to let in-flight requests complete

### Verification

```bash
# Nginx upstream health
curl -sI https://<domain>/health | head -1

# Check all upstreams are in pool
# (stub_status module)
curl -s http://localhost:8090/nginx_status

# ALB — describe target group health
aws elbv2 describe-target-health --target-group-arn <arn>
```

---

## 2. REVERSE PROXIES

### Problem

Reverse proxies sit in front of application servers to handle SSL
termination, buffering, caching, rate limiting, IP filtering, and
request rewriting so your app code doesn't have to.

### 2.1 Nginx — Full Reverse Proxy with Rate Limiting

```nginx
# Rate limiting zones (defined in http context)
limit_req_zone  $binary_remote_addr  zone=api:10m  rate=30r/s;
limit_req_zone  $binary_remote_addr  zone=login:10m rate=5r/m;
limit_conn_zone $binary_remote_addr  zone=conn_per_ip:10m;

server {
    listen 443 ssl http2;
    server_name <api.example.com>;

    # IP whitelist for admin endpoints
    geo $admin_access {
        default         0;
        <10.0.0.0/8>    1;
        <203.0.113.0/24> 1;
    }

    # --- Request size limits ---
    client_max_body_size 10M;

    # --- Buffering ---
    proxy_buffering    on;
    proxy_buffers      8 16k;
    proxy_buffer_size  4k;
    proxy_busy_buffers_size 16k;

    # --- Rate limit general API ---
    location /api/ {
        limit_req  zone=api burst=20 nodelay;
        limit_conn conn_per_ip 50;

        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- Stricter limit for login ---
    location /api/auth/login {
        limit_req  zone=login burst=2 nodelay;
        proxy_pass http://backend;
    }

    # --- IP-whitelisted admin ---
    location /admin/ {
        if ($admin_access = 0) {
            return 403;
        }
        proxy_pass http://backend;
    }
}
```

### 2.2 Caching Layer with Nginx

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=static:100m
                 max_size=10g inactive=60d use_temp_path=off;

server {
    location /static/ {
        proxy_cache        static;
        proxy_cache_valid  200 302  24h;
        proxy_cache_valid  404        1m;
        proxy_cache_use_stale error timeout updating http_500 http_502 http_503;

        # Cache key includes query string but ignores version params
        proxy_cache_key "$scheme$request_method$host$uri$is_args$args";

        # Bypass cache for health checks
        proxy_cache_bypass $http_cache_control;

        # Add header so you can verify cache hit/miss
        add_header X-Cache-Status $upstream_cache_status;

        proxy_pass http://backend;
    }
}
```

### Common Pitfalls

- **No rate limiting** — one bad client can saturate your entire app; always start with conservative per-IP limits
- **Timeouts at default** — Nginx defaults (60s) are too long; set explicit timeouts
- **client_max_body_size too low** — silently returns 413; document the limit your app needs
- **No proxy buffers** — disables buffering by default; upstream writes block when client is slow
- **Buffering for WebSockets** — WebSocket and SSE connections must set `proxy_buffering off`

### Verification

```bash
# Confirm rate limiting is enforced
for i in $(seq 1 35); do curl -s -o /dev/null -w "%{http_code}\n" https://<api>/endpoint; done

# Check X-Cache-Status header
curl -sI https://<domain>/static/bundle.js | grep -i x-cache-status

# Verify IP whitelist
curl -s -o /dev/null -w "%{http_code}" https://<domain>/admin/
```

---

## 3. API GATEWAYS

### Problem

As you grow from one service to many, clients need a single entry
point that handles authentication, rate limiting, routing, request
transformation, and canary deployments — without each service
duplicating that logic.

### 3.1 Kong Gateway (OSS) — Service + Route + Plugin

```yaml
# declarative.yml — apply with: kong config db_import
_format_version: "3.0"

services:
  - name: user-service
    url: http://<user-svc>:4000
    routes:
      - name: user-routes
        paths:
          - /users
        methods: [GET, POST, PUT, DELETE]
        strip_path: false
    plugins:
      - name: rate-limiting
        config:
          minute: 60
          hour: 1000
          policy: local
      - name: key-auth
        config:
          key_names: ["X-API-Key"]
          hide_credentials: true
      - name: cors
        config:
          origins:
            - https://<app.example.com>
          methods: [GET, POST, PUT, DELETE, OPTIONS]
          headers: ["Content-Type", "Authorization", "X-API-Key"]
          preflight_continue: false

  - name: billing-service
    url: http://<billing-svc>:4001
    routes:
      - name: billing-routes
        paths:
          - /billing
        methods: [GET, POST]
        strip_path: false
    plugins:
      - name: rate-limiting
        config:
          minute: 20
          hour: 200
          policy: local
      - name: jwt
        config:
          claims_to_verify: ["exp"]
      - name: acl
        config:
          allow:
            - admin
            - premium
```

### 3.2 Kong Rate Limiting with Sliding Window

```yaml
plugins:
  - name: rate-limiting-advanced
    config:
      limit:
        - 100
      window_size:
        - 60
      sliding_window: true
      retry_after_jitter_max: 5
      error_code: 429
      error_message: "Rate limit exceeded — retry after {retry_after}s"
```

### 3.3 AWS API Gateway — REST with Usage Plans

```hcl
resource "aws_api_gateway_rest_api" "api" {
  name        = "<api-name>"
  description = "API Gateway for microservices"
}

resource "aws_api_gateway_usage_plan" "plan" {
  name        = "basic"
  description = "Basic tier: 1000 req/day"

  api_stages {
    api_id = aws_api_gateway_rest_api.api.id
    stage  = "prod"
  }

  throttle_settings {
    burst_limit = 100       # max requests in a burst
    rate_limit  = 50        # steady-state requests/sec
  }

  quota_settings {
    limit  = 1000
    period = "DAY"
  }
}
```

### Common Pitfalls

- **Gateway as monolith bottleneck** — ensure it's horizontally scalable; Kong can run on Kubernetes with autoscaling
- **Throttling before auth** — unauthenticated requests consume rate-limit budgets; apply API key or JWT auth *before* rate limiting
- **Over-fragmentation** — one route per endpoint is unmanageable; group by service/path prefix
- **No CORS preflight handling** — gateways must handle OPTIONS before auth or requests fail; set `preflight_continue: false` so the gateway responds directly
- **Logging disabled** — you lose request-level visibility; enable access logs on the gateway

### Verification

```bash
# Kong health + available services
curl -s http://localhost:8001/status | jq .

# Trigger throttling
for i in $(seq 1 70); do curl -s -o /dev/null -w "%{http_code}\n" \
  -H "X-API-Key: <key>" https://<kong-proxy>/users; done | sort | uniq -c

# Gateway access logs
tail -f /var/log/kong/access.log
```

---

## 4. DNS

### Problem

DNS is the first lookup in every user request. Misconfigured DNS means
downtime even when your servers are healthy, slow TTLs block traffic
shifts during incidents, and missing records cause silent failures.

### 4.1 AWS Route53 — Record Sets + Failover

```hcl
resource "aws_route53_zone" "main" {
  name = "<example.com>"
}

# Primary (active) record
resource "aws_route53_record" "app_active" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.<example.com>"
  type    = "A"

  alias {
    name                   = aws_lb.app_active.dns_name
    zone_id                = aws_lb.app_active.zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "PRIMARY"
  }

  set_identifier = "us-east-1-active"
}

# Secondary (DR) record
resource "aws_route53_record" "app_dr" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "app.<example.com>"
  type    = "A"

  alias {
    name                   = aws_lb.app_dr.dns_name
    zone_id                = aws_lb.app_dr.zone_id
    evaluate_target_health = true
  }

  failover_routing_policy {
    type = "SECONDARY"
  }

  set_identifier = "us-west-2-dr"
}
```

### 4.2 Cloudflare — Proxied (Orange Cloud) DNS

Cloudflare DNS records can be **proxied** (orange cloud) or **DNS-only**
(grey cloud). Always proxy for CDN, DDoS, and SSL benefits.

```terraform
resource "cloudflare_record" "app" {
  zone_id = cloudflare_zone.main.id
  name    = "app"
  value   = "<lb-public-ip-or-hostname>"
  type    = "A"
  proxied = true                     # orange cloud — enables CDN/DDOS/WAF
  ttl     = 1                        # 1 = automatic (Cloudflare manages)
}

resource "cloudflare_record" "api" {
  zone_id = cloudflare_zone.main.id
  name    = "api"
  value   = "<api-gateway-hostname>"
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

resource "cloudflare_record" "mx" {
  zone_id = cloudflare_zone.main.id
  name    = "@"
  value   = "aspmx.l.google.com"
  type    = "MX"
  proxied = false                    # mail can't proxy
  ttl     = 300
  priority = 1
}
```

### 4.3 TTL Strategy

| Record type | TTL | Rationale |
|-------------|-----|-----------|
| A / CNAME (load-balanced) | 60s | Fast traffic shift during failover |
| ALIAS / proxied (Cloudflare) | Auto | Cloudflare manages internally |
| MX | 300s (5 min) | Balance failover speed vs. query volume |
| TXT (SPF, DKIM) | 3600s (1h) | Rarely changes |
| NS | 86400s (24h) | Changes require planning; cached ahead |

### Common Pitfalls

- **TTL too long before migration** — lower TTL to 60s *48 hours before* changing a record so caches expire quickly
- **Apex CNAME** — most DNS providers don't support CNAME at the zone apex (`@`); use ALIAS (Route53/Cloudflare/NS1) or A record
- **Missing health checks on Route53** — without `evaluate_target_health`, DNS returns unhealthy LB nodes
- **No DNSSEC** — signed zones prevent cache poisoning; enable on Route53 and Cloudflare under DNSSEC settings

### Verification

```bash
dig +short app.<example.com>     # resolve to expected IP/LB
dig +short MX <example.com>      # mail routes correctly

# Check propagation (anycast resolvers)
dig @1.1.1.1 app.<example.com>
dig @8.8.8.8 app.<example.com>

# DNSSEC chain
dig +dnssec app.<example.com> | grep "RRSIG\|flags:"
```

---

## 5. CDN & EDGE CACHING

### Problem

Every millisecond of latency costs conversions. CDNs serve static and
dynamic content from edge locations closest to the user, absorb traffic
spikes, and reduce origin load.

### 5.1 Cloudflare — Cache Rules

```terraform
resource "cloudflare_zone" "main" {
  name     = "<example.com>"
  plan     = "pro"                  # or "enterprise" for more cache control
}

# Page rule: cache everything on static paths
resource "cloudflare_page_rule" "static_cache" {
  zone_id = cloudflare_zone.main.id
  target  = "*<example.com>/static/*"
  actions {
    cache_level         = "cache_everything"
    edge_cache_ttl      = 604800     # 7 days
    browser_cache_ttl   = 14400      # 4 hours
    bypass_cache_on_cookie = "session"
  }
}

# Cache rule for API (Cache Rules API, modern way)
resource "cloudflare_zone_cache_reserve" "main" {
  zone_id = cloudflare_zone.main.id
  value   = 1                        # enable origin read (Enterprise)
}
```

### 5.2 AWS CloudFront — Distribution with Origin Shield

```hcl
resource "aws_cloudfront_distribution" "cdn" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = "PriceClass_100"   # NA + EU only; PriceClass_All for global

  origin {
    domain_name = "<lb-public-dns>"
    origin_id   = "origin-lb"
    origin_shield {
      enabled        = true
      origin_shield_region = "us-east-1"       # origin shield region
    }

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id          = "origin-lb"
    viewer_protocol_policy    = "redirect-to-https"
    allowed_methods           = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods            = ["GET", "HEAD"]
    compress                  = true

    forwarded_values {
      query_string = true
      cookies {
        forward = "whitelist"
        whitelisted_names = ["session_id", "csrf_token"]
      }
    }

    min_ttl     = 0
    default_ttl = 60
    max_ttl     = 604800
  }

  # Cache behavior for static assets with longer TTL
  ordered_cache_behavior {
    path_pattern             = "/static/*"
    target_origin_id         = "origin-lb"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    min_ttl                  = 0
    default_ttl              = 86400
    max_ttl                  = 31536000
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"        # or "whitelist"/"blacklist"
      # locations      = ["US", "CA"]
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = aws_acm_certificate.main.arn
    minimum_protocol_version       = "TLSv1.2_2021"
    ssl_support_method             = "sni-only"
  }

  custom_error_response {
    error_code            = 404
    response_page_path    = "/index.html"    # SPA fallback
    response_code         = 200
    error_caching_min_ttl = 10
  }
}
```

### 5.3 Purge / Invalidation

```bash
# CloudFront — invalidate by path
aws cloudfront create-invalidation \
  --distribution-id <id> \
  --paths "/index.html" "/static/*"

# Cloudflare — purge everything (API v4)
curl -X POST "https://api.cloudflare.com/client/v4/zones/<zone_id>/purge_cache" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything": true}'

# Cloudflare — purge by URL
curl -X POST "https://api.cloudflare.com/client/v4/zones/<zone_id>/purge_cache" \
  -H "Authorization: Bearer <token>" \
  -d '{"files":["https://<domain>/index.html","https://<domain>/app.js"]}'
```

### Common Pitfalls

- **Caching authenticated content** — never cache API responses with `Set-Cookie` or `Authorization` unless explicitly intended
- **Origin Shield disabled on CloudFront** — without it every edge POP fetches from origin independently, defeating cache efficiency
- **Query string variance** — if query params produce identical content, configure CloudFront to forward only relevant params or forward "none"
- **Cache invalidation cost** — CloudFront invalidations cost per path and are rate-limited; use versioned URLs (`/static/main.a1b2c3.js`) instead
- **No compression** — always enable `compress: true`; CDN bandwidth bills hurt when assets are uncompressed

### Verification

```bash
# Confirm CDN cache hit
curl -sI https://<domain>/static/app.js | grep -E "CF-Cache-Status|X-Cache"

# Check which edge node served the request
curl -sI https://<domain>/ | grep -i "cf-ray|server"

# Verify compression is on
curl -sH "Accept-Encoding: gzip" -o /dev/null -w "%{size_download}" https://<domain>/static/app.js

# Invalidation progress
aws cloudfront get-invalidation --distribution-id <id> --id <invalidation-id>
```

---

## 6. HTTP/2 & HTTP/3

### Problem

HTTP/1.1 opens multiple TCP connections per page load, wasting
handshake latency. HTTP/2 multiplexes streams over one connection.
HTTP/3 (QUIC) eliminates head-of-line blocking even at the transport
layer and improves performance on lossy networks.

### 6.1 Nginx — HTTP/2 + HTTP/3

```nginx
server {
    # HTTP/2 over TLS (standard)
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    # HTTP/3 (QUIC) — requires Nginx ≥1.25 with quiche or BoringSSL
    listen 443 quic reuseport;
    listen [::]:443 quic reuseport;

    ssl_certificate     /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;

    # Protocol negotiation
    add_header Alt-Svc 'h3=":443"; ma=86400';   # advertise HTTP/3 to clients
    add_header Strict-Transport-Security "max-age=63072000" always;

    # SSL settings that affect HTTP/2 negotiation
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HTTP/2 tuning
    http2_max_concurrent_streams 128;
    http2_recv_timeout 10s;
}
```

### 6.2 Server Push — Do Not Use (Legacy)

HTTP/2 server push is being removed from Chrome and most CDNs.
Push performance was often worse than letting the browser discover
resources naturally.

**Instead**: use `103 Early Hints` if supported, or preload links:

```nginx
# Modern approach: 103 Early Hints (Nginx ≥1.25)
# Requires patch or 3rd-party module — most setups do this at
# the CDN layer (Cloudflare Early Hints) instead of the origin.
```

```html
<!-- Link preload in HTML is more reliable than push -->
<link rel="preload" href="/critical.css" as="style">
<link rel="preload" href="/hero.webp" as="image">
```

### 6.3 Cloudflare — HTTP/3

Cloudflare enables HTTP/3 automatically on proxied zones. Verify:

```bash
curl -sI --http3 https://<domain>/ | grep -i "alt-svc"
# Look for: alt-svc: h3=":443"; ma=86400
```

### Common Pitfalls

- **HTTP/2 connection coalescing** — browsers reuse one HTTP/2 connection for multiple hostnames if DNS resolves to the same IP and TLS cert covers them; ensure your SAN covers all subdomains if you want coalescing
- **QUIC blocked by firewalls** — some corporate firewalls drop UDP (which QUIC uses); HTTP/2 fallback happens automatically, but monitor for degraded users
- **No HTTP/2 on non-TLS connections** — browsers only support HTTP/2 over TLS; plain HTTP remains HTTP/1.1; redirect all HTTP to HTTPS
- **Server push abuse** — avoid it entirely; use 103 Early Hints or preload links instead

### Verification

```bash
# HTTP/2 negotiation
curl -sI --http2 https://<domain>/ | grep -i "HTTP/2"

# HTTP/3 support via Alt-Svc header
curl -sI https://<domain>/ | grep -i "alt-svc"

# Test HTTP/3 specifically
curl --http3 -sI https://<domain>/ 2>&1 | head -5
```

---

## 7. gRPC

### Problem

REST with JSON is flexible but wasteful for internal service-to-service
communication. gRPC uses Protocol Buffers, HTTP/2 multiplexing, and
bidirectional streaming for efficient, typed inter-service calls.

### 7.1 Service Definition (Proto)

```protobuf
syntax = "proto3";

package user.v1;

service UserService {
  rpc GetUser (GetUserRequest) returns (User);
  rpc ListUsers (ListUsersRequest) returns (stream User);
  rpc UpdateUser (stream UpdateUserRequest) returns (User);
  rpc Chat (stream ChatMessage) returns (stream ChatMessage);
}

message GetUserRequest {
  string user_id = 1;
}

message User {
  string id        = 1;
  string email     = 2;
  string full_name = 3;
  int64  created_at = 4;
}

message ListUsersRequest {
  int32 page_size  = 1;
  string page_token = 2;
}
```

### 7.2 Nginx gRPC Passthrough

```nginx
server {
    listen 443 ssl http2;
    server_name <grpc.example.com>;

    ssl_certificate     /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;

    location /user.v1.UserService/ {
        grpc_pass grpc://backend_grpc;

        # gRPC timeouts — gRPC is streaming; set appropriately
        grpc_connect_timeout 5s;
        grpc_send_timeout    60s;
        grpc_read_timeout    60s;

        # Enable gRPC passthrough
        grpc_set_header Content-Type application/grpc;
        grpc_set_header TE trailers;
    }
}

upstream backend_grpc {
    server <grpc-server>:50051;
}
```

### 7.3 gRPC vs REST — Decision Matrix

| Use gRPC when... | Use REST when... |
|---|---|
| Internal microservice calls | Public/external APIs |
| High-volume, low-latency needed | Browser-based clients |
| Streaming / bidirectional flows | Simple CRUD resources |
| Strongly typed contracts required | Loose coupling preferred |
| Polyglot environment (code gen) | Protobuf tooling overhead hurts |

### Common Pitfalls

- **No gRPC-Web proxy** — browsers cannot speak HTTP/2 gRPC natively; use `envoy`, `grpc-web`, or a gateway that translates gRPC-Web to gRPC
- **Overloaded load balancers** — gRPC keeps long-lived HTTP/2 connections; round-robin may not balance well; use least-requests or client-side load balancing
- **Large messages without streaming** — gRPC per-message limit defaults to 4 MB; use streaming for anything larger
- **No health checks** — gRPC services must expose health/probe endpoints distinct from HTTP health checks
- **Deadline propagation** — always propagate `grpc-timeout` from client to server; failed calls should fail fast, not hang

### Verification

```bash
# gRPC health check (requires grpc_health_probe)
grpc_health_probe -addr=<grpc-server>:50051

# List gRPC services (requires grpcurl)
grpcurl -plaintext <grpc-server>:50051 list

# Invoke a specific RPC
grpcurl -d '{"user_id": "abc"}' <grpc-server>:50051 user.v1.UserService/GetUser

# Verify Nginx gRPC pass-through (via LB)
grpcurl <domain>:443 user.v1.UserService/GetUser
```

---

## 8. WEBSOCKETS, SSE & LONG POLLING

### Problem

HTTP request-response is stateless. Real-time UI (chat, notifications,
collaborative editing) needs persistent, low-latency connections.
Each technique has different tradeoffs.

### 8.1 Technique Selection

| Technique | Direction | Latency | Reconnect | Overhead | Best for |
|-----------|-----------|---------|-----------|----------|----------|
| **WebSocket** | Bidirectional | Real-time | Automatic (libraries) | Low per-message | Chat, live cursors, games, trading |
| **SSE** | Server→client only | Real-time | Automatic (EventSource API) | Very low | Notifications, feed updates, logs |
| **Long Polling** | Simulated bidir | Latency = poll interval | Manual | High (frequent HTTP calls) | Legacy clients, fallback |

### 8.2 Nginx WebSocket Proxy

```nginx
map $http_upgrade $connection_upgrade {
    default      upgrade;
    ''           close;
}

server {
    listen 443 ssl http2;
    server_name <ws.example.com>;

    location /ws/ {
        proxy_pass http://websocket_backend;

        # WebSocket upgrades
        proxy_http_version 1.1;
        proxy_set_header Upgrade              $http_upgrade;
        proxy_set_header Connection           $connection_upgrade;
        proxy_set_header Host                 $host;
        proxy_set_header X-Real-IP            $remote_addr;
        proxy_set_header X-Forwarded-For      $proxy_add_x_forwarded_for;

        # Disable buffering — critical for WebSockets
        proxy_buffering off;
        proxy_request_buffering off;

        # WebSocket timeouts — long-running connections
        proxy_read_timeout    3600s;           # 1h idle before disconnect
        proxy_send_timeout    3600s;

        # Max message size (default 1M)
        client_max_body_size  4k;
    }
}

upstream websocket_backend {
    least_conn;
    server <ws-app-1>:8080;
    server <ws-app-2>:8080;
}
```

### 8.3 SSE (Server-Sent Events) Proxy

SSE is just HTTP streaming. Key: never buffer.

```nginx
location /events {
    proxy_pass http://sse_backend;
    proxy_http_version 1.1;

    # NEVER buffer SSE
    proxy_buffering  off;
    proxy_cache      off;

    # Keep connection alive for long-lived streams
    proxy_read_timeout 86400s;          # 24h

    # Let the app set Content-Type: text/event-stream
    proxy_set_header Host $host;
}
```

### Common Pitfalls

- **No WebSocket load balancer support** — ALB and NLB support WebSockets natively; Classic LB does not; ensure your LB passes the `Upgrade` header
- **Sticky sessions required for WebSockets** — once upgraded, WebSocket connections pin to a backend; enable stickiness or route by path prefix per service
- **SSE not buffered** — if you proxy_buffering on, SSE data accumulates until the buffer fills; the client sees delayed bursts instead of real-time events
- **Long polling overhead** — each poll opens a new HTTP connection; if polling every second, 1,000 clients generate 1,000 req/s even with no new data
- **Connection limits** — each WebSocket holds a file descriptor; set `worker_connections` high enough for your concurrent user count

### Verification

```bash
# Test WebSocket upgrade
curl -sI -H "Upgrade: websocket" -H "Connection: Upgrade" \
  https://<domain>/ws/ | grep -i "upgrade\|101"

# Verify SSE streaming (response should chunk)
timeout 5 curl -sN https://<domain>/events

# Check active connections on Nginx
curl -s http://localhost:8090/nginx_status | grep "Active"
```

---

## 9. WAF & DDOS PROTECTION

### Problem

A single attacker can saturate your origin with bot traffic, SQL
injection payloads, or layer-7 floods. A Web Application Firewall
inspects requests before they reach your app and blocks malicious
traffic at the edge.

### 9.1 Cloudflare WAF — Custom Rules

```terraform
resource "cloudflare_ruleset" "waf" {
  zone_id = cloudflare_zone.main.id
  kind    = "zone"
  phase   = "http_request_firewall_custom"

  rules {
    action      = "block"
    description = "Block requests missing User-Agent"
    expression  = "(not http.request.headers.named.user_agent)"
    enabled     = true
  }

  rules {
    action      = "block"
    description = "Block common SQL injection patterns"
    expression  = <<-EOT
      (lower(http.request.body.args) contains "union select" or
       lower(http.request.body.args) contains "drop table" or
       lower(http.request.uri) contains "sql=")
    EOT
    enabled     = true
  }

  rules {
    action      = "block"
    description = "Block requests from known bad IPs"
    expression  = "(ip.src in {<203.0.113.0/24> <198.51.100.0/24>})"
    enabled     = true
  }
}

# Rate limiting rule (Advanced)
resource "cloudflare_ruleset" "rate_limit" {
  zone_id = cloudflare_zone.main.id
  kind    = "zone"
  phase   = "http_ratelimit"

  rules {
    action      = "block"
    description = "Sensitive endpoints: 10 requests per minute"
    expression  = "(starts_with(http.request.uri.path, \"/api/auth\"))"
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src", "cf.client.bot", "http.request.headers.named.x-api-key"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 600                    # block for 10 min
    }
  }

  rules {
    action      = "block"
    description = "Global: 500 requests per 5 minutes"
    expression  = "(not cf.client.bot)"            # exclude known bots
    enabled     = true

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 300
      requests_per_period = 500
      mitigation_timeout  = 120
    }
  }
}
```

### 9.2 AWS WAF — Web ACL with Rate-Based Rules

```hcl
resource "aws_wafv2_web_acl" "main" {
  name        = "main-web-acl"
  scope       = "REGIONAL"                     # or "CLOUDFRONT" for edge
  description = "WAF for production workloads"

  default_action {
    allow {}
  }

  # Rate-based rule: block IPs exceeding threshold
  rule {
    name     = "rate-limit-global"
    priority = 0

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "RateLimitGlobal"
      sampled_requests_enabled  = true
    }
  }

  # Managed rule set: AWS core security rules
  rule {
    name     = "aws-managed-core"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # Exclude rules that cause false positives for your app
        rule_action_override {
          name = "NoUserAgent_HEADER"
          action_to_use {
            count {}                              # count instead of block
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name               = "AWSManagedCoreRules"
      sampled_requests_enabled  = true
    }
  }

  # IP reputation list
  rule {
    name     = "block-known-bad-ips"
    priority = 2
    action {
      block {}
    }
    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.bad_ips.arn
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name               = "MainWebACL"
    sampled_requests_enabled  = true
  }
}

resource "aws_wafv2_ip_set" "bad_ips" {
  name               = "blocked-ips"
  scope              = "REGIONAL"
  ip_address_version = "IPV4"
  addresses          = ["<203.0.113.0/32>", "<198.51.100.0/24>"]
}
```

### 9.3 Nginx Layer-7 Rate Limiting (Without CDN)

```nginx
# In http context
limit_req_zone  $binary_remote_addr  zone=flood:10m    rate=30r/s;
limit_req_zone  $http_x_api_key      zone=api_key:10m  rate=100r/s;

limit_conn_zone $binary_remote_addr  zone=perip:10m    max=50;

# In server context
location /api/ {
    limit_req  zone=flood burst=10 nodelay;
    limit_conn perip 20;

    # Optional: only allow specific HTTP methods
    if ($request_method !~ ^(GET|POST|PUT|DELETE|OPTIONS)$) {
        return 405;
    }

    # Block common attack patterns
    set $blocked 0;
    if ($query_string ~* "union.*select.*\(") { set $blocked 1; }
    if ($query_string ~* "base64_decode")      { set $blocked 1; }
    if ($blocked) { return 403; }

    proxy_pass http://backend;
}
```

### Common Pitfalls

- **WAF blocking legitimate traffic** — always ship WAF rules in `COUNT` (monitor) mode first, review logs for false positives, then switch to `BLOCK`
- **Rate limiting by IP behind a CDN** — CDN requests all come from CDN IPs; rate-limit by `CF-Connecting-IP` (Cloudflare) or `X-Forwarded-For` instead
- **Only layer-3/4 DDoS protection** — application-layer attacks (slow loris, HTTP flood) need layer-7 rules; don't rely solely on AWS Shield Standard or Cloudflare's free tier for complex attacks
- **No bot mitigation** — scrapers and credential stuffing bypass simple rate limits; enable Cloudflare Bot Management or AWS WAF Bot Control
- **Expensive WAF bills from noise** — monitor sampled requests and prune rules that trigger on benign traffic; `managed_rule_group` statements cost per request

### Verification

```bash
# Confirm WAF is counting/blocking
aws wafv2 get-web-acl --name main-web-acl --scope REGIONAL --id <id>

# Check Cloudflare security events
curl -s -H "Authorization: Bearer <token>" \
  "https://api.cloudflare.com/client/v4/zones/<zone_id>/security/events" \
  | jq '.result | .[] | {action, ip, rule_id, timestamp}'

# Trigger rate limit
for i in $(seq 1 50); do curl -s -o /dev/null -w "%{http_code}\n" \
  https://<domain>/api/auth/login; done | sort | uniq -c

# Nginx rate-limiting counters
curl -s http://localhost:8090/nginx_status | grep "limit_req"
```

---

## 10. TLS / SSL

### Problem

Without TLS every request is plaintext — passwords, tokens, and
customer data flow across the internet unencrypted. Beyond enabling
HTTPS, proper cipher suites, HSTS, certificate automation, and
mutual TLS (mTLS) are required for production.

### 10.1 Let's Encrypt with Certbot

```bash
# Install (varies by distro — example for Ubuntu)
sudo apt install certbot python3-certbot-nginx

# Obtain cert for single domain
sudo certbot --nginx -d <example.com> -d <www.example.com>

# Wildcard cert (DNS challenge)
sudo certbot -d <*.example.com> --manual --preferred-challenges dns

# Auto-renewal (certbot installs systemd timer by default)
sudo certbot renew --dry-run
```

### 10.2 Nginx — Mozilla Intermediate TLS Profile

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name <example.com>;

    # Certificate paths
    ssl_certificate     /etc/letsencrypt/live/<domain>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/<domain>/privkey.pem;

    # Intermediate profile (Mozilla SSL Config Generator)
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;                   # better to disable for PFS

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    # OCSP stapling — so browsers don't hammer the CA
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout 5s;

    # HSTS — tell browsers to always use HTTPS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # HTTP → HTTPS redirect
}

server {
    listen 80;
    server_name <example.com>;
    return 301 https://$host$request_uri;
}
```

### 10.3 Mutual TLS (mTLS)

mTLS authenticates the *client* in addition to the server. Used for
service-to-service communication and zero-trust networks.

```nginx
server {
    listen 443 ssl http2;
    server_name <internal-api.example.com>;

    # Server certificate
    ssl_certificate     /etc/nginx/certs/server.crt;
    ssl_certificate_key /etc/nginx/certs/server.key;

    # CA certificate to verify clients
    ssl_client_certificate /etc/nginx/certs/ca.crt;
    ssl_verify_client      on;
    ssl_verify_depth       2;

    # Pass verified client certificate to upstream
    proxy_set_header X-Client-Cert $ssl_client_escaped_cert;
    proxy_set_header X-Client-DN  $ssl_client_s_dn;

    location / {
        # Deny if client cert is not verified
        if ($ssl_client_verify != "SUCCESS") {
            return 403;
        }
        proxy_pass http://backend;
    }
}
```

### 10.4 Generating mTLS Certificates (OpenSSL)

```bash
# Generate CA
openssl req -new -x509 -days 3650 -nodes \
  -out ca.crt -keyout ca.key \
  -subj "/CN=Internal CA"

# Generate server cert (signed by CA)
openssl req -new -nodes \
  -out server.csr -keyout server.key \
  -subj "/CN=<internal-api.example.com>"
openssl x509 -req -in server.csr -days 365 \
  -CA ca.crt -CAkey ca.key -CAcreateserial -out server.crt

# Generate client cert (signed by same CA)
openssl req -new -nodes \
  -out client.csr -keyout client.key \
  -subj "/CN=<service-name>"
openssl x509 -req -in client.csr -days 365 \
  -CA ca.crt -CAkey ca.key -CAcreateserial -out client.crt
```

### Common Pitfalls

- **Old cipher suites (RC4, 3DES)** — these are broken; use the Mozilla Intermediate list above
- **SSL session tickets without rotation** — if enabled, rotate the ticket key on every restart or disable (`ssl_session_tickets off`)
- **HSTS without `includeSubDomains`** — partial coverage; always include subdomains and use `preload` after testing
- **Certificate expiry** — Let's Encrypt certs expire in 90 days; monitor renewal via cron/systemd timer and alert if renewal fails
- **mTLS without intermediate trust** — if your CA signs intermediate CAs, set `ssl_verify_depth` high enough (at least 2)
- **OCSP stapling not configured** — without it every browser contacts the CA on first visit, increasing page load time and leaking user IPs

### Verification

```bash
# Check certificate expiry
openssl s_client -connect <domain>:443 -servername <domain> \
  2>/dev/null | openssl x509 -noout -dates

# Verify TLS 1.3 negotiation
openssl s_client -tls1_3 -connect <domain>:443 -servername <domain> \
  2>/dev/null | grep -i "protocol\|cipher"

# Check HSTS header
curl -sI https://<domain>/ | grep -i "strict-transport-security"

# Verify OCSP stapling
openssl s_client -connect <domain>:443 -servername <domain> -status \
  2>/dev/null | grep -i "OCSP"

# Verify mTLS (expect failure without client cert)
curl -s -o /dev/null -w "%{http_code}" https://<internal-api>/

# Verify mTLS (with client cert)
curl -s --cert client.crt --key client.key -o /dev/null -w "%{http_code}" \
  https://<internal-api>/
```

---

## 11. CORS

### Problem

Browsers block cross-origin HTTP requests by default. Without proper
CORS headers, your API running at `api.example.com` cannot be called
from `app.example.com`, mobile apps, or third-party integrations.

### 11.1 Nginx — CORS Headers

```nginx
server {
    listen 443 ssl http2;
    server_name <api.example.com>;

    # Preflight (OPTIONS) — handled before auth to avoid credential errors
    location / {
        if ($request_method = OPTIONS) {
            add_header Content-Length               0;
            add_header Content-Type                 text/plain;
            add_header Access-Control-Allow-Origin   "https://<app.example.com>";
            add_header Access-Control-Allow-Methods  "GET, POST, PUT, DELETE, PATCH, OPTIONS";
            add_header Access-Control-Allow-Headers  "Content-Type, Authorization, X-API-Key, X-Requested-With";
            add_header Access-Control-Max-Age        3600;
            add_header Access-Control-Allow-Credentials true;
            return 204;
        }

        # Actual requests
        add_header Access-Control-Allow-Origin       "https://<app.example.com>" always;
        add_header Access-Control-Allow-Methods      "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
        add_header Access-Control-Allow-Headers      "Content-Type, Authorization, X-API-Key" always;
        add_header Access-Control-Expose-Headers     "X-RateLimit-Remaining, X-Request-Id" always;
        add_header Access-Control-Allow-Credentials  true always;

        if ($http_origin ~* "^https?://(<allowed-domain>\.com)$") {
            # Dynamic origin reflection for multiple trusted domains
            add_header Access-Control-Allow-Origin "$http_origin" always;
        }

        proxy_pass http://backend;
    }
}
```

### 11.2 Cloudflare — CORS via Transform Rules

```terraform
resource "cloudflare_ruleset" "cors" {
  zone_id = cloudflare_zone.main.id
  kind    = "zone"
  phase   = "http_response_headers_transform"

  rules {
    expression  = "(starts_with(http.request.uri.path, \"/api/\"))"
    description = "Add CORS headers to API responses"
    enabled     = true

    action = "rewrite"
    action_parameters {
      headers {
        name = "Access-Control-Allow-Origin"
        operation = "set"
        value = "https://<app.example.com>"
      }
      headers {
        name = "Access-Control-Allow-Credentials"
        operation = "set"
        value = "true"
      }
      headers {
        name = "Access-Control-Expose-Headers"
        operation = "set"
        value = "X-Request-Id, X-RateLimit-Remaining"
      }
    }
  }
}
```

### 11.3 CORS Preflight Cache

Preflight (OPTIONS) requests add latency to every new cross-origin
interaction. Cache them with `Access-Control-Max-Age`.

```nginx
# In Nginx (already shown above):
add_header Access-Control-Max-Age 3600;
```

Browser caches the OPTIONS response for this many seconds.
Set to `3600` (1h) for most APIs, `86400` for stable endpoints.

### Common Pitfalls

- **CORS errors that are really network errors** — a 404 or 500 response still gets CORS headers; if the browser shows a CORS error, the preflight OPTIONS itself is failing, not the actual request
- **`Access-Control-Allow-Origin: *` with credentials** — browser rejects `*` when `Allow-Credentials: true`; you must echo the specific origin
- **Credentials included for all origins** — only set `Access-Control-Allow-Credentials: true` if your API relies on cookies; mobile/web apps with token auth don't need it
- **Missing `Access-Control-Allow-Headers`** — if your app sends custom headers (`X-API-Key`, `Authorization`), list them explicitly; the browser blocks requests that include headers not in the allow list
- **CORS in CDN responses** — if your CDN caches a response from one origin and serves it to another, the `Access-Control-Allow-Origin` gets mismatched; either Vary by Origin or use a wildcard origin

### Verification

```bash
# Test preflight
curl -s -X OPTIONS -D - "https://<api.example.com>/endpoint" \
  -H "Origin: https://<app.example.com>" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization" \
  -o /dev/null 2>&1 | grep -i "access-control"

# Test actual cross-origin request
curl -s -D - "https://<api.example.com>/endpoint" \
  -H "Origin: https://<app.example.com>" \
  -o /dev/null 2>&1 | grep -i "access-control"

# Confirm browser-style CORS rejection (no Origin header should still work)
curl -s -o /dev/null -w "%{http_code}" "https://<api.example.com>/endpoint"

# Verify Vary header for CDN-cached CORS
curl -sI "https://<cdn-domain>/api/data" | grep -i "vary"
```

---

## VERIFICATION CHECKLIST

Before signing off on any infra-networking change:

- [ ] **Load Balancers** — health checks pass for all upstreams; deregistration delay is ≥60s; at least 2 LB instances exist
- [ ] **Reverse Proxy** — rate limiting enforced (verify with burst test); `client_max_body_size` matches app limits; buffering configured per endpoint type
- [ ] **API Gateway** — routing works for all services; auth plugin applied before rate limiting; logs enabled and shipping to central sink
- [ ] **DNS** — all records resolve correctly; TTLs lowered before any planned migration; DNSSEC enabled; health checks wired for failover records
- [ ] **CDN** — cache hits confirmed via headers; Origin Shield enabled (CloudFront); purge strategy documented; versioned assets (query string or path hash)
- [ ] **HTTP/2 & HTTP/3** — HTTP/2 negotiated on TLS connections; Alt-Svc header present for HTTP/3; server push disabled (use preload/103 Early Hints instead)
- [ ] **gRPC** — proto definitions versioned; health probes configured; Nginx grpc_pass working; message size limits known and documented; gRPC-Web proxy in place for browser clients
- [ ] **WebSockets / SSE** — `proxy_buffering off` set; upgrade headers wired; idle timeout ≥1h; connection limits sized for concurrent users; sticky sessions enabled if needed
- [ ] **WAF / DDoS** — rules deployed in COUNT mode first, then switched to BLOCK after false-positive review; rate limiting by client IP (not CDN IP); bot mitigation enabled
- [ ] **TLS/SSL** — cert auto-renewal configured and tested; HSTS with `includeSubDomains` and `preload`; cipher suite scans clean; OCSP stapling verified; mTLS certificates rotated annually
- [ ] **CORS** — preflight returns 204 with correct headers; `Access-Control-Allow-Origin` matches app domain(s); credentials flag set correctly; Vary: Origin present for CDN-cached responses
- [ ] **Logging** — all layers (LB, proxy, gateway, WAF) shipping structured logs to a central sink (CloudWatch, ELK, Grafana Loki)
- [ ] **Rollback** — every networking change has a documented rollback step (revert config, swap DNS, re-enable previous LB)

## RULES

- ALWAYS use `<placeholder>` notation for domains, IPs, secrets, ARNs in config
- ALWAYS run `nginx -t` or `haproxy -c -f` before reloading
- ALWAYS verify changes in staging before production
- ALWAYS set up monitoring and alerts for every layer (LB 5xx, cert expiry, WAF blocks)
- ALWAYS pair rate limiting with proper error responses (429 with Retry-After header)
- NEVER deploy TLS without OCSP stapling and HSTS
- NEVER open a load balancer directly to the internet without WAF or security group rules
- NEVER use `*` for CORS when credentials are sent
- NEVER disable TLS 1.2 in favor of only TLS 1.3 — many enterprise clients still use 1.2
- NEVER commit real secrets, API tokens, or private keys to a repo
