---
title: Database Scaling
description: "Connection pooling, read replicas, sharding, migration strategies, rollback plans, query performance optimization."
triggers:
  - "database scaling"
  - "connection pooling"
  - "read replicas"
  - "sharding"
  - "database migration"
  - "migration rollback"
  - "query optimization"
  - "slow queries"
owner-agent: backend
---

# Database Scaling

## Connection Pooling
- Use PgBouncer (PostgreSQL) or ProxySQL (MySQL)
- Pool mode: transaction-level for web apps
- Pool size: `(2 × CPU cores × connections per core)` — benchmark to find sweet spot
- Monitor: pool utilization, wait time, queue depth

## Read Replicas
- Direct read queries to replica
- Write queries to primary
- Handle replication lag (read-after-write consistency via primary reads for critical paths)
- Monitor: replica lag (target < 1s)

## Sharding
- Horizontal sharding by tenant ID or hashed key
- Avoid cross-shard joins (denormalize or application-level join)
- Use consistent hash ring for even distribution
- Monitor: shard imbalance (hot spots)

## Migrations
- **Forward-only** (no destructive rollbacks)
- Backward-compatible changes only
- Use migration framework (Prisma, Flyway, Alembic)
- **Safe patterns:**
  - Add column: default value or nullable first
  - Remove column: first stop using in code, then drop after deploy
  - Rename column: add new column, dual-write, backfill, switch reads, drop old
  - Add index: `CONCURRENTLY` (PostgreSQL) to avoid table locks
- **Rollback plan:** a compensating forward migration

## Performance Optimization
Slow query triage:
1. Enable slow query log
2. `EXPLAIN ANALYZE` the query
3. Missing index? → add it
4. Too many joins? → denormalize or cache
5. Large dataset? → paginate or partition

## Backup Strategy
- Full backup: daily
- WAL archival: continuous (point-in-time recovery)
- Retention: 30 days daily, 12 monthly
- Test backup restore quarterly
