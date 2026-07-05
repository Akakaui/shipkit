# PRODUCTION HARDENING — Infrastructure & DevOps Orchestrator

## PURPOSE

Routes infrastructure, DevOps, distributed systems, and
production engineering tasks to the right CODE sub-agent.
This is the master orchestrator for all the concepts that
"vibe coders" skip — until the app gets its first million users.

## TRIGGERS

- "Harden my app for production"
- "Set up infrastructure"
- "Dockerize my project"
- "Deploy with Kubernetes"
- "Configure load balancing"
- "Set up CI/CD pipeline"
- "Database optimization"
- "Distributed systems design"
- "Production monitoring"
- "Disaster recovery"
- "Scaling strategy"
- "API gateway setup"
- "Add rate limiting / caching"
- "Resilience patterns"
- "Any request mentioning: load balancer, reverse proxy, K8s, Terraform, CDN, sharding, pub/sub, saga, circuit breaker, dead letter queue, read replica, autoscaling, chaos engineering, P99 latency"

## AGENT ROUTING TABLE

When this skill is loaded, CODE routes sub-tasks:

| Topic | Agent | Skill to load |
|-------|-------|--------------|
| Load Balancing, Reverse Proxies, API Gateways, DNS, CDN, HTTP/2, HTTP/3, gRPC, WAF, DDoS | Deployer | infra-networking.skill.md |
| Docker, Kubernetes, Helm, Service Discovery, Autoscaling, IaC, Terraform | Deployer | container-orch.skill.md |
| CAP Theorem, Event-Driven Architecture, Pub/Sub, Saga Pattern, Distributed Transactions, Leader Election, Eventual Consistency, Clock Skew, Network Partitions | Architect | distributed-systems.skill.md |
| Circuit Breakers, Retries, Exponential Backoff, Timeouts, Idempotency, Dead Letter Queues, Bulkheads, Backpressure | Backend | resilience-patterns.skill.md |
| Database Indexing, Query Optimization, N+1 Queries, Connection Pooling, Read Replicas, Sharding, Partitioning, Database Migrations | Backend | db-scale.skill.md |
| SLOs/SLIs/Error Budgets, Incidents, On-call, Postmortems, Disaster Recovery, Failover, Multi-Region, Backups, Chaos Engineering | Deployer | prod-ops.skill.md |

## WORKFLOW

### Step 1: Identify the Need

Parse the user's request and identify which production
hardening categories are needed. A single request may
span multiple categories.

### Step 2: Load Sub-Skill Context

Load the relevant sub-skill(s) for detailed guidance,
config templates, and best practices.

### Step 3: Delegate to Agent

Route each sub-task to the appropriate agent with:
- The sub-skill loaded
- Clear scope of what to configure/generate
- Expected output (config file, code, architecture diagram)
- Stack constraints

### Step 4: Verify Hardening

After all sub-tasks complete, verify:

- [ ] No hardcoded configs
- [ ] All secrets via env/secrets manager
- [ ] Rate limiting configured
- [ ] Caching strategy in place
- [ ] Health checks implemented
- [ ] Graceful degradation works
- [ ] Logging + metrics configured
- [ ] Deployment has rollback plan
- [ ] Database has connection pooling
- [ ] Auth uses proper OAuth/JWT flow
- [ ] Error responses don't leak internals
- [ ] Timeouts and retries configured
- [ ] Idempotency on all write endpoints
- [ ] CORS and CSP configured
- [ ] Monitoring alerts set up

### Step 5: Handoff

Pass verified infra to Deployer for staging deploy,
then production after user approval.

## RULES

- ALWAYS load the relevant sub-skill before delegating
- ALWAYS produce runnable configs (Dockerfile, K8s YAML, Nginx conf, Terraform), not theory
- ALWAYS verify hardening checklist before handoff
- NEVER deploy to production without user approval
- NEVER hardcode secrets even in config examples
- NEVER skip security when hardening
- NEVER leave placeholder values without validation
- ALWAYS pair infra changes with a rollback plan
