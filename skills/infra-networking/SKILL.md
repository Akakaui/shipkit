---
title: Infrastructure & Networking
description: "Production networking — CDN, DNS, WAF, load balancers, SSL management, DDoS protection, multi-region deployment."
triggers:
  - "set up CDN"
  - "configure DNS"
  - "WAF rules"
  - "load balancing"
  - "SSL certificate"
  - "DDoS protection"
  - "multi-region"
  - "edge networking"
owner-agent: deployer
---

# Infra & Networking

## CDN
- Use Cloudflare or AWS CloudFront
- Cache static assets (cache-control headers)
- Purge cache on deploy

## DNS
- Use Cloudflare DNS (fastest propagation)
- CNAME for www → apex
- A/AAAA records with proxied (orange cloud)
- TXT records for SPF, DKIM, DMARC

## WAF
- Block common attack patterns (SQLi, XSS)
- Rate limit by IP (100 req/min per IP)
- Geo-block if only serving specific regions
- Challenge suspicious requests

## Load Balancers
- Health check endpoint (`/health`)
- Sticky sessions only if needed (use distributed sessions)
- SSL termination at LB level
- Connection draining for blue-green deploys

## SSL
- Auto-renew with Let's Encrypt (Certbot) or Cloudflare
- HSTS header (`Strict-Transport-Security: max-age=31536000; includeSubDomains`)
- Redirect HTTP → HTTPS

## DDoS Protection
- Cloudflare Always Online
- Network-layer DDoS (L3/L4): Cloudflare or AWS Shield
- Application-layer (L7): Rate limiting + WAF

## Multi-Region
- Active-passive (simpler, cheaper): one region live, one standby
- Active-active: multi-region reads, single-region writes (or conflict resolution)
- Global load balancer for routing
