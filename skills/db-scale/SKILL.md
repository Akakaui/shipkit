# DB SCALE — Database Scaling, Optimization & Production Operations

## PURPOSE

Production-grade patterns for database indexing, query
optimization, connection management, and scaling strategies.
Every section contains runnable SQL and verification queries.
This is a sub-skill of the production-hardening system.

## TRIGGERS

- "Database is slow"
- "Queries timing out"
- "N+1 problem"
- "Add indexing"
- "Connection pool exhausted"
- "Scale the database"
- "Read replica setup"
- "Sharding strategy"
- "Partitioning tables"
- "Database migration"
- "Backup / restore"
- "Any production-hardening task routed from the orchestrator"

---

### 1. DATABASE INDEXING

**Problem:** Full table scans on large tables (>100k rows) kill
performance. Without correct indexes, even simple WHERE clauses
become O(n) sequential scans.

**Index Types & When to Use:**

| Type | Use Case | Example |
|------|----------|---------|
| B-tree | Equality + range queries, sorting | `WHERE status = 'active'`, `WHERE created_at > now()` |
| Hash | Equality only, fixed-size keys | `WHERE session_id = 'abc'` (UUIDs, hashes) |
| GIN | Array/JSONB/full-text search | `WHERE tags @> ARRAY['urgent']`, `WHERE doc @@ to_tsquery('cat')` |
| GiST | Geometry, range types, full-text | `WHERE location <@ polygon`, `WHERE period && '[2024-01,2024-03]'` |
| BRIN | Physically-sorted huge tables | `WHERE created_at BETWEEN '2024-01-01' AND '2024-01-02'` on a 1B-row append-only table |

**Composite Index — Column Order Rules:**

```sql
-- BAD: high-selectivity column first, low-selectivity second
CREATE INDEX idx_bad ON orders (user_id, status);  -- user_id is unique-ish

-- GOOD: equality first, range/order last
CREATE INDEX idx_good ON orders (status, created_at DESC);
-- Query: WHERE status = 'pending' ORDER BY created_at DESC

-- BEST: covering index (all columns in query)
CREATE INDEX idx_covering ON orders (status, created_at DESC) INCLUDE (total, currency);
-- Index-only scan — no heap lookup. Also avoids fetching tuples for the INCLUDE columns.
```

**Partial Indexes:**

```sql
-- Index only the active orders (99% of queries filter on this)
CREATE INDEX idx_active_orders ON orders (created_at DESC) WHERE status = 'active';

-- Query that uses it:
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'active' AND created_at > now() - interval '7 days';
```

**Common Pitfall — Over-indexing:**
Every index slows INSERT/UPDATE/DELETE. A table with 12 indexes
can be 3x slower on writes than one with 3. Measure write latency
before and after adding indexes on write-heavy tables.

**Verification — Missing Indexes:**

```sql
-- PostgreSQL: find missing indexes from seq scans
SELECT relname, seq_scan, seq_tup_read, idx_scan,
       seq_tup_read / NULLIF(seq_scan, 0) AS avg_rows_per_seq_scan
FROM pg_stat_user_tables
WHERE seq_scan > 1000 AND seq_tup_read / NULLIF(seq_scan, 0) > 1000
ORDER BY seq_tup_read DESC;

-- Find unused indexes (drop candidate):
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND idx_tup_read = 0
ORDER BY tablename;
```

**Monitor:** `pg_stat_user_tables.idx_scan` vs `seq_scan` ratio per table.
Alert when seq_scan ratio > 0.3 on tables > 10k rows.

---

### 2. QUERY OPTIMIZATION

**Problem:** The query planner makes bad decisions when statistics
are stale, or the query is written in a way that prevents index
usage.

**Reading EXPLAIN ANALYZE:**

```sql
EXPLAIN (ANALYZE, BUFFERS, TIMING) 
SELECT o.*, u.email
FROM orders o
JOIN users u ON u.id = o.user_id
WHERE o.status = 'pending'
  AND o.created_at > now() - interval '7 days'
ORDER BY o.created_at DESC;
```

**What to look for:**
- **Seq Scan on large table** → missing index
- **Sort (Memory: xxxMB)** → index can pre-sort, or increase `work_mem`
- **Nested Loop with many loops** → missing index on inner table
- **Rows= vs actual rows=** (big discrepancy) → stale stats, run `ANALYZE`
- **Buffers: shared hit=** vs `read=` → hit ratio < 99% means not enough RAM

**Slow Query Logging (PostgreSQL):**

```ini
# postgresql.conf — enable with low threshold in dev, 500ms in prod
log_min_duration_statement = 200       # log queries > 200ms
log_connections = on
log_disconnections = on
log_line_prefix = '%t [%p]: [%l] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_lock_waits = on                     # log waits > deadlock_timeout
```

Then monitor with `pgBadger` or `pg_stat_statements`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 queries by total time:
SELECT queryid,
       ROUND(total_exec_time::numeric, 2) AS total_ms,
       calls,
       ROUND(mean_exec_time::numeric, 2) AS avg_ms,
       ROUND(shared_blks_hit * 100.0 / NULLIF(shared_blks_hit + shared_blks_read, 0), 2) AS hit_ratio
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat%'
ORDER BY total_exec_time DESC
LIMIT 10;
```

**Query Rewriting Techniques:**

```sql
-- BAD: function on indexed column prevents index use
SELECT * FROM orders WHERE EXTRACT(YEAR FROM created_at) = 2024;
-- GOOD: range query uses B-tree index
SELECT * FROM orders WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01';

-- BAD: leading wildcard prevents index
SELECT * FROM products WHERE name LIKE '%search_term%';
-- BETTER: use GIN with pg_trgm
CREATE INDEX idx_name_trgm ON products USING gin (name gin_trgm_ops);
SELECT * FROM products WHERE name ILIKE '%search_term%';

-- BAD: IN list with many values (planner may overestimate)
SELECT * FROM orders WHERE status IN ('pending', 'processing', 'shipped', 'delivered');
-- GOOD: use ANY with array or a VALUES join for very large lists
SELECT * FROM orders WHERE status = ANY(ARRAY['pending', 'processing', 'shipped', 'delivered']);
```

**Verification:**

```sql
-- Check if the query uses the index you expect
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;

-- Check hit ratio for the database
SELECT 'buffer_hit_ratio' AS metric,
       ROUND(blks_hit * 100.0 / NULLIF(blks_hit + blks_read, 0), 2) AS value
FROM pg_stat_database WHERE datname = current_database();
```

**Monitor:** `pg_stat_statements.mean_exec_time` — alert when P50 of any
top-10 query exceeds 100ms, or P99 exceeds 1s.

---

### 3. N+1 QUERIES

**Problem:** 1 query fetches N parent rows, then N queries fetch
children. Classic ORM anti-pattern. 101 queries instead of 2.
On a 500ms-latency DB, that's 50s vs 1s.

**Detection:**

```sql
-- PostgreSQL: log all queries and count per request
-- Set log_min_duration_statement = 0 in dev, correlate by session
-- Or use pg_stat_statements to find query counts per endpoint
SELECT calls, LEFT(query, 80) AS query_preview
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;
```

```javascript
// Node.js / Express: log query count per request
app.use((req, res, next) => {
  const start = db.queryCount;
  res.on('finish', () => {
    const count = db.queryCount - start;
    if (count > 10) console.warn(`N+1 risk: ${req.path} — ${count} queries`);
  });
  next();
});
```

```ruby
# Rails: enable bullet gem in development
# Gemfile
gem 'bullet', group: [:development, :test]

# config/environments/development.rb
config.after_initialize do
  Bullet.enable = true
  Bullet.alert = true       # JavaScript alert
  Bullet.bullet_logger = true
  Bullet.console = true
  Bullet.add_footer = true  # shows N+1 warnings in page footer
end
```

**Fixes by ORM:**

```prisma
// Prisma: use `include` or `select` with nested relations
// BAD — N+1:
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } });  // N queries
}

// GOOD — eager load:
const usersWithPosts = await prisma.user.findMany({
  include: { posts: true },   // 1 query with JOIN
  take: 50,
});

// GOOD — batch load with `in` (dataloader pattern):
const userIds = users.map(u => u.id);
const posts = await prisma.post.findMany({ where: { authorId: { in: userIds } } });
```

```typescript
// TypeORM: use `relations`
// BAD — N+1:
const users = await userRepository.find();
for (const user of users) {
  const posts = await userRepository.find({ where: { author: user } });
}

// GOOD — eager load:
const users = await userRepository.find({ relations: ['posts'] });

// GOOD — QueryBuilder with JOIN:
const users = await userRepository
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'post')
  .getMany();
```

```python
# Django ORM: use select_related (FK) or prefetch_related (M2M/reverse)
# BAD — N+1:
users = User.objects.all()
for user in users:
    posts = Post.objects.filter(author=user)  # N queries

# GOOD — FK field:
users = User.objects.select_related('profile').all()

# GOOD — M2M / reverse FK:
users = User.objects.prefetch_related('posts').all()
# 2 queries total: one for users, one for posts WHERE author_id IN (...)
```

**Dataloader Pattern (Generic):**

```typescript
// Generic batch loader — coalesces N individual loads into one batched query
class DataLoader<K, V> {
  private queue: Map<K, Promise<V>> = new Map();
  
  async load(key: K, loader: (keys: K[]) => Promise<V[]>): Promise<V> {
    if (!this.queue.has(key)) {
      // Batch all keys loaded in this microtask tick
      const promise = new Promise<V>(async (resolve) => {
        await queueMicrotask(async () => {
          const keys = [...this.queue.keys()] as K[];
          const results = await loader(keys);
          keys.forEach((k, i) => resolve(results[i]));
        });
      });
      this.queue.set(key, promise);
    }
    return this.queue.get(key)!;
  }
}

// Usage — N GraphQL resolvers become 1 SQL query
const loader = new DataLoader<number, Post[]>();
const posts = await loader.load(userId, async (ids) => {
  const rows = await db.query('SELECT * FROM posts WHERE author_id = ANY($1)', [ids]);
  return ids.map(id => rows.filter(r => r.author_id === id));
});
```

**Verification:** After fixing, same endpoint should show exactly
2 queries (1 for parents + 1 for children) instead of 1 + N.

**Monitor:** Alert when any request handler triggers > 10 SQL
queries (log at `log_min_duration_statement = 0` and count per
trace ID). For GraphQL, use `@tanstack/react-query` devtools or
Apollo tracing to track query-per-resolver counts.

---

### 4. CONNECTION POOLING

**Problem:** Opening a PostgreSQL TCP connection takes ~20-50ms
of handshake overhead. Under load, 100 req/s × 1 new connection each
= 2-5 seconds per second spent on handshakes. Worse, unbounded
connections crash the database.

**Pool Sizing Formula:**

```
max_connections = ((core_count * 2) + effective_spindle_count)
```

For a typical 8-core server with SSD:
`((8 * 2) + 1) = 17 connections per node`

For async frameworks (Node.js, Go, async Python):
`core_count * 1` — async handles concurrency internally.

**PgBouncer (PostgreSQL connection pooler):**

```ini
# pgbouncer.ini — install BETWEEN app and database (port 6432)
[databases]
* = host=127.0.0.1 port=5432 dbname=myapp

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

# Pool mode: transaction is safest for web apps
pool_mode = transaction
# session = keep connection for entire client session
# statement = release after each statement (risky, use only for simple queries)

default_pool_size = 25          # matches the formula above
max_client_conn = 200           # queued clients waiting for a connection
reserve_pool_size = 5           # extra connections when pool is stressed
reserve_pool_timeout = 3        # seconds before using reserve
max_db_connections = 50         # hard cap per database
server_idle_timeout = 300       # close idle server connections after 5 min
query_timeout = 30              # kill queries running > 30s
```

```bash
# userlist.txt — hashed password (use `pgbouncer` to generate)
"myapp_user" "SCRAM-SHA-256$4096:hash..."
```

**Node.js (node-postgres) Pool Config:**

```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '6432'), // point at PgBouncer
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Pool settings:
  max: 20,                    // max connections, match pgbouncer default_pool_size
  idleTimeoutMillis: 30000,   // close idle client after 30s
  connectionTimeoutMillis: 5000,  // fail fast if no connection available
  
  // Statement timeout (critical for preventing runaway queries):
  statement_timeout: 30000,   // 30s
});

// Health check — verify the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exitCode = 1;
});

// Use with async/await
async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 100) {
    console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
  }
  return res;
}
```

**HikariCP (Java/Spring Boot):**

```yaml
# application.yml
spring:
  datasource:
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      idle-timeout: 300000
      connection-timeout: 5000
      max-lifetime: 1800000
      pool-name: MyAppPool
      data-source-properties:
        socketTimeout: 30000
```

**Common Pitfall — Pool Exhaustion:**
When the pool runs out of connections, requests queue up. If
queries take 5s and pool is 20, throughput caps at 4 req/s.
**Symptoms:** `timeout waiting for idle connection`, P99 latency
spikes, connection timeout errors.

**Fix:** Add monitoring + reduce query latency OR increase pool
(but never exceed `max_connections` in PostgreSQL — default is 100).

**Verification:**

```sql
-- Check active vs idle connections per pool
SELECT state, COUNT(*) AS connections,
       wait_event_type, wait_event
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, wait_event_type, wait_event
ORDER BY connections DESC;

-- Check if connections are hitting max
SELECT max_conn, used_conn,
       ROUND(used_conn * 100.0 / max_conn, 1) AS pct_used
FROM (
  SELECT setting::int AS max_conn FROM pg_settings WHERE name = 'max_connections'
) m,
(
  SELECT COUNT(*) AS used_conn
  FROM pg_stat_activity
  WHERE datname = current_database() AND state = 'active'
) u;
```

**Monitor:** `pool_lifecycle.active_connections` / `max_connections`
ratio. Alert when > 80% sustained for 5 minutes. Alert on any pool
exhaustion errors (connection timeout).

---

### 5. READ REPLICAS

**Problem:** The primary database handles both reads and writes.
When read traffic grows, the primary's CPU and I/O get saturated.
Read replicas offload SELECT queries to secondary nodes.

**When to Add Replicas:**

- Read-to-write ratio exceeds 10:1
- Primary CPU consistently > 60% during peak
- Query latency increases under read load
- You need dedicated nodes for reporting/analytics

**Read/Write Splitting (Application-Level):**

```typescript
// Node.js — explicit split
import { Pool } from 'pg';

const writer = new Pool({
  host: process.env.DB_PRIMARY_HOST,
  max: 10,
});

const reader = new Pool({
  host: process.env.DB_REPLICA_HOST,  // round-robin DNS or load balancer
  max: 20,
});

// Route reads to replica, writes to primary
export async function getUser(id: number) {
  const { rows } = await reader.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
}

export async function createUser(data: UserInput) {
  const { rows } = await writer.query(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
    [data.name, data.email]
  );
  return rows[0];
}
```

```python
# Django — database router
# settings.py
DATABASES = {
    'default': { 'NAME': 'app', 'HOST': 'primary.cdb.example.com' },
    'replica': { 'NAME': 'app', 'HOST': 'replica.cdb.example.com' },
}

DATABASE_ROUTERS = ['myapp.db_router.PrimaryReplicaRouter']

# db_router.py
class PrimaryReplicaRouter:
    def db_for_read(self, model, **hints):
        return 'replica'
    
    def db_for_write(self, model, **hints):
        return 'default'
    
    def allow_relation(self, obj1, obj2, **hints):
        return True
```

**Handling Replication Lag:**

```sql
-- Check lag on the replica
SELECT
  now() - pg_last_xact_replay_timestamp() AS replication_lag,
  pg_last_wal_receive_lsn(),
  pg_last_wal_replay_lsn();
```

```typescript
// Stale read tolerance: don't read from replica if user just wrote
const recentWrites = new Map<number, number>();  // userId -> timestamp

function onUserWrite(userId: number) {
  recentWrites.set(userId, Date.now());
}

async function getUserWithConsistency(userId: number) {
  const lastWrite = recentWrites.get(userId);
  if (lastWrite && (Date.now() - lastWrite) < 5000) {
    // User wrote in last 5 seconds — read from primary
    return await primaryQuery('SELECT * FROM users WHERE id = $1', [userId]);
  }
  // Otherwise read from replica
  return await replicaQuery('SELECT * FROM users WHERE id = $1', [userId]);
}
```

**Common Pitfall — Stale Reads After Writes:**
User creates a resource, gets redirected, and the next page (served
from replica) doesn't show it yet. **Fix:** Route reads for the
current user's recent writes to the primary for 5-10 seconds.

**Monitor:** Replication lag in seconds. Alert if > 30s for sync
or > 5s for async replicas serving user-facing traffic.

**Verification:**

```sql
-- Verify replication is working
SELECT application_name, state, sync_state,
       write_lag, flush_lag, replay_lag
FROM pg_stat_replication;

-- Ensure replica is receiving WAL
SELECT pg_current_wal_lsn(), pg_current_wal_insert_lsn();
-- On replica:
SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();
```

---

### 6. SHARDING

**Problem:** A single database can no longer handle the data volume
(> 2-4 TB) or write throughput. Indexes no longer fit in memory.
Vertical scaling (bigger machine) hits limits or becomes uneconomical.

**Horizontal vs Vertical Sharding:**

| Approach | How | When |
|----------|-----|------|
| Vertical | Split tables across databases | Tables are unrelated, joins are rare |
| Horizontal | Split rows across databases | Single large table, user-based access pattern |

**IMPORTANT:** Sharding is the LAST resort. Optimize indexes, add
replicas, and partition first. Sharding adds enormous complexity
— cross-shard queries, distributed transactions, schema changes.

**Shard Key Selection (Hash-Based):**

```sql
-- Hash sharding: deterministic, even distribution
-- Application computes shard: shard = hash(shard_key) % num_shards

-- Connection routing (application-level)
CREATE TABLE orders_0 (CHECK (user_id % 4 = 0));
CREATE TABLE orders_1 (CHECK (user_id % 4 = 1));
CREATE TABLE orders_2 (CHECK (user_id % 4 = 2));
CREATE TABLE orders_3 (CHECK (user_id % 4 = 3));

-- Create a UNION ALL view for cross-shard queries
CREATE VIEW orders_all AS
SELECT * FROM orders_0 UNION ALL
SELECT * FROM orders_1 UNION ALL
SELECT * FROM orders_2 UNION ALL
SELECT * FROM orders_3;
```

```typescript
// Node.js shard router
class ShardRouter {
  private shards: Pool[];
  
  constructor(shardConfigs: string[]) {
    this.shards = shardConfigs.map(host => new Pool({ host }));
  }
  
  getShard(shardKey: string): Pool {
    const hash = this.hashCode(shardKey);
    return this.shards[Math.abs(hash) % this.shards.length];
  }
  
  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash;
  }
  
  async queryByUser(userId: number, sql: string, params?: any[]) {
    return this.getShard(userId.toString()).query(sql, params);
  }
}
```

**Range-Based Sharding (for time-series):**

```sql
-- Shard by month
CREATE TABLE orders_2024_01 (...);
CREATE TABLE orders_2024_02 (...);
-- Application routes: WHERE created_at >= '2024-01-01' AND created_at < '2024-02-01'
```

**Cross-Shard Query Problem:**
Queries that span shards must scatter (query all shards) or be
prohibited. **Fix:** Design the shard key so that most queries
target one shard. JOINs across shards require a middleware layer
(Citus, Vitess, Spanner) or application-level fan-out.

**Rebalancing:**

```bash
# Adding a new shard from 4 to 5 shards:
# 1. Set up new shard (db5)
# 2. Copy 20% of data to it (rehash)
# 3. Dual-write during transition period
# 4. Read from old + new, compare
# 5. Switch reads to new shard
# 6. Remove data from old shard

# Tools: pg_repack, pg_chameleon, Citus rebalance
```

**Common Pitfall — Hot Shard:**
A poor shard key (e.g., tenant_id when one tenant has 50% of data)
creates a single overloaded shard. **Fix:** Use a composite shard
key like `(tenant_id % 100, tenant_id)` to spread a large tenant.

**Monitor:** Per-shard query latency, disk usage, connection count.
Alert when any shard deviates > 20% from the mean for any metric.

---

### 7. PARTITIONING

**Problem:** A table has billions of rows. Indexes are huge,
`VACUUM` takes forever, old data is never pruned. Partitioning
splits the table logically while keeping a single SQL interface.

**When to Partition:**
- Table > 100 GB or > 100 million rows
- Clear partition key (date, tenant_id, region)
- Old data needs periodic deletion (partition DROP is instant)
- Query pattern always includes the partition key

**PostgreSQL Partitioning:**

```sql
-- Range partitioning (most common — time-series)
CREATE TABLE events (
    id BIGSERIAL,
    created_at TIMESTAMPTZ NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2024_q1 PARTITION OF events
    FOR VALUES FROM ('2024-01-01') TO ('2024-04-01');
CREATE TABLE events_2024_q2 PARTITION OF events
    FOR VALUES FROM ('2024-04-01') TO ('2024-07-01');
CREATE TABLE events_2024_q3 PARTITION OF events
    FOR VALUES FROM ('2024-07-01') TO ('2024-10-01');
CREATE TABLE events_2024_q4 PARTITION OF events
    FOR VALUES FROM ('2024-10-01') TO ('2025-01-01');

-- Add default partition for out-of-range data
CREATE TABLE events_default PARTITION OF events DEFAULT;

-- List partitioning (for categories/regions)
CREATE TABLE customers (
    id BIGSERIAL, name TEXT, region TEXT
) PARTITION BY LIST (region);

CREATE TABLE customers_na PARTITION OF customers FOR VALUES IN ('US', 'CA', 'MX');
CREATE TABLE customers_eu PARTITION OF customers FOR VALUES IN ('GB', 'DE', 'FR', 'NL');
CREATE TABLE customers_apac PARTITION OF customers FOR VALUES IN ('JP', 'CN', 'AU', 'SG');

-- Hash partitioning (for evenly distributing data)
CREATE TABLE sessions (
    session_id TEXT, data JSONB, created_at TIMESTAMPTZ
) PARTITION BY HASH (session_id);

CREATE TABLE sessions_0 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE sessions_1 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE sessions_2 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE sessions_3 PARTITION OF sessions FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

**Partition Pruning Verification:**

```sql
-- Verify the planner only hits relevant partitions
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM events
WHERE created_at >= '2024-06-01' AND created_at < '2024-07-01';

-- Look for: "Seq Scan on events_2024_q2" (only 1 partition scanned)
-- If you see "Append" with all partitions, pruning failed — add partition key to WHERE clause
```

**Adding Partitions (Zero-Downtime):**

```sql
-- Detach old partition for archiving
ALTER TABLE events DETACH PARTITION events_2024_q1;

-- Attach as table (data stays)
-- Now you can archive or drop the table

-- Add new partition before queries hit it
CREATE TABLE events_2025_q1 PARTITION OF events
    FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

-- Automate with pg_partman extension
CREATE EXTENSION IF NOT EXISTS partman;
SELECT partman.create_parent(
    p_parent_table := 'public.events',
    p_control := 'created_at',
    p_type := 'native',
    p_interval := '3 months',
    p_premake := 4
);

-- Auto-maintenance (runs via pg_cron or scheduled task):
SELECT partman.run_maintenance();
```

**Partitioning vs Sharding Decision Table:**

| Factor | Partition | Shard |
|--------|-----------|-------|
| Data volume | 100 GB – 10 TB | > 10 TB |
| Write throughput | Up to single-node capacity | Beyond single-node |
| Cross-partition queries | Supported, same database | Complex, scatter-gather |
| Complexity | Low | Very high |
| Operational overhead | Low (built-in) | High (routing, rebalancing) |
| Schema changes | Applied once | Applied to each shard |

**Monitor:** Check partition count vs planned. Each partition adds
overhead (catalogs, stats). PostgreSQL handles 1000+ partitions
but 10,000+ causes planning slowness. Use monthly or quarterly
partitions, not daily, unless you have > 100M rows/month.

---

### 8. REPLICATION

**Problem:** Need high availability (HA) and disaster recovery (DR).
Replication copies data to standby servers for failover and read
offloading.

**Streaming Replication (PostgreSQL Built-in):**

```ini
# primary: postgresql.conf
wal_level = replica
max_wal_senders = 5           # number of standby servers
wal_keep_size = 1024          # MB of WAL to retain (fallback if replica falls behind)
max_replication_slots = 5

# standby: postgresql.conf
primary_conninfo = 'host=primary-host port=5432 user=replicator password=...'
primary_slot_name = 'standby_1'
hot_standby = on              # allow read queries on standby
```

```bash
# Set up the standby:
# 1. Backup primary
pg_basebackup -h primary-host -D /var/lib/postgresql/data -U replicator -P -v --wal-method=stream

# 2. Create recovery.signal on standby
touch /var/lib/postgresql/data/standby.signal

# 3. Start standby
pg_ctl start
```

**Synchronous Replication (Zero Data Loss):**

```ini
# primary: postgresql.conf
synchronous_commit = on
synchronous_standby_names = 'FIRST 1 (standby_1, standby_2)'

# Now every commit waits for at least 1 standby to confirm write.
# Trade-off: write latency increases by network round-trip (~1-10ms).
```

**Failover Procedure:**

```bash
# Promote standby to primary
pg_ctl promote -D /var/lib/postgresql/data

# Or using pg_ctlcluster:
pg_ctlcluster 16 main promote

# Verify new primary:
psql -c "SELECT pg_is_in_recovery();"   # should return f

# OR use repmgr for automated failover:
repmgr standby promote --node-id=2
repmgr node rejoin -d 'host=new-primary' --force-rewind
```

**Logical Replication (Different PostgreSQL versions, selective tables):**

```sql
-- publisher (primary)
CREATE PUBLICATION my_pub FOR TABLE users, orders;
-- Or for all tables: CREATE PUBLICATION my_pub FOR ALL TABLES;

-- subscriber (standby)
CREATE SUBSCRIPTION my_sub
CONNECTION 'host=primary-host port=5432 dbname=myapp user=replicator'
PUBLICATION my_pub;
```

**Replication Slot Management:**

```sql
-- List all replication slots
SELECT slot_name, slot_type, database,
       active, restart_lsn, wal_status
FROM pg_replication_slots;

-- Drop an unused slot (critical if it's causing WAL accumulation!)
-- Dropping a slot lets PostgreSQL reclaim WAL; DO this after standby is decommissioned
SELECT pg_drop_replication_slot('standby_1');
```

**Common Pitfall — Replication Slot WAL Buildup:**
If a standby disconnects, the replication slot prevents WAL cleanup.
WAL files accumulate until the disk fills. **Fix:** Monitor
`pg_replication_slots.wal_status` — alert on `lost` or `reserved`
for more than 30 minutes. Set up `wal_keep_size` and use a
`max_slot_wal_keep_size` cap.

**Verification:**

```sql
-- On primary: check standby status
SELECT client_addr, state, sync_state,
       (pg_wal_lsn_diff(pg_current_wal_lsn(), write_lag) / 1024 / 1024)::int AS mb_behind
FROM pg_stat_replication;

-- On standby: check replay progress
SELECT pg_is_in_recovery(), pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn(),
       pg_last_xact_replay_timestamp();
```

**Monitor:** Replication lag in MB and seconds. Alert if lag >
100 MB or > 30 seconds for async, > 5 seconds for sync.

---

### 9. DATABASE MIGRATIONS

**Problem:** Schema changes lock tables, break running queries,
and cause downtime. Without a migration strategy, teams fear
changing the database.

**Expand-Migrate-Contract Pattern (Zero-Downtime):**

```
Phase 1: Expand
  - Add new columns/tables (no old code depends on them)
  - CREATE INDEX CONCURRENTLY (non-blocking)
  - Deploy new application code (writes to both old + new)

Phase 2: Migrate
  - Backfill new columns (batched, low_priority)
  - Run data migration scripts
  - Verify data consistency

Phase 3: Contract
  - Remove old columns/deprecated code
  - DROP INDEX CONCURRENTLY
  - Deploy cleanup code
```

**Safe Index Creation:**

```sql
-- NEVER do this in production (blocks writes on the table):
CREATE INDEX idx_users_email ON users (email);

-- ALWAYS do this in production (non-blocking, takes longer):
CREATE INDEX CONCURRENTLY idx_users_email ON users (email);

-- Drop with care:
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email_old;
```

**Backward-Compatible Schema Changes:**

```sql
-- ✅ SAFE: Add nullable column
ALTER TABLE users ADD COLUMN phone TEXT;

-- ✅ SAFE: Add column with default (PostgreSQL 11+ — no table rewrite)
ALTER TABLE users ADD COLUMN notifications_enabled BOOLEAN DEFAULT true;

-- ⚠️ RISKY: Add NOT NULL column without default (locks table)
ALTER TABLE users ADD COLUMN tenant_id BIGINT NOT NULL;
-- FIX: Add as nullable, backfill, then set NOT NULL
ALTER TABLE users ADD COLUMN tenant_id BIGINT;
UPDATE users SET tenant_id = 1 WHERE tenant_id IS NULL;  -- backfill in batches
ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;

-- ❌ DANGEROUS: Rename column (breaks existing queries)
ALTER TABLE users RENAME COLUMN email TO email_address;
-- FIX: Add new column, dual-write, migrate, drop old

-- ✅ SAFE: Add a CHECK constraint (no full table scan?)
ALTER TABLE orders ADD CONSTRAINT positive_total CHECK (total >= 0);
-- NOT VALID variant: no scan, but only applies to new rows
ALTER TABLE orders ADD CONSTRAINT positive_total CHECK (total >= 0) NOT VALID;
ALTER TABLE orders VALIDATE CONSTRAINT positive_total;  -- validate later
```

**Migration Tool Configs:**

```yaml
# Flyway (Java) — flyway.conf
flyway.url = jdbc:postgresql://localhost:5432/myapp
flyway.user = myapp_user
flyway.password = ${DB_PASSWORD}
flyway.locations = filesystem:db/migration
flyway.baselineOnMigrate = true
flyway.outOfOrder = false
flyway.validateOnMigrate = true
```

```bash
# Flyway commands
flyway migrate        # apply pending migrations
flyway info           # check status
flyway validate       # verify checksums
flyway repair         # fix schema_history table
```

```yaml
# Prisma — schema.prisma (use with `prisma migrate deploy`)
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pg_stat_statements, pg_trgm, uuid_ossp]
}

model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(uuid()) @db.Uuid
  title     String
  content   String?
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String   @db.Uuid
  createdAt DateTime @default(now())
}
```

```bash
# Alembic (Python) — migration workflow
alembic init alembic              # initialize
alembic revision --autogenerate -m "add phone column"
alembic upgrade head              # apply

# alembic/env.py — configure connection
from myapp.config import DATABASE_URL
config.set_main_option('sqlalchemy.url', DATABASE_URL)
```

**Rollback Strategy:**

```bash
# Flyway: no built-in undo (use versioned rollback scripts)
# V2__add_phone.sql → V2_1__undo_add_phone.sql

# Alembic: downgrade
alembic downgrade -1

# Prisma: no rollback — use `prisma migrate diff` to generate a rollback script
npx prisma migrate diff --to-empty --from-schema-datamodel prisma/schema.prisma
```

**Verification:**

```sql
-- Check migration history
SELECT version, description, installed_on, success
FROM schema_migrations
-- Or for Flyway: flyway_schema_history
-- Or for Alembic: alembic_version
ORDER BY installed_rank DESC;
```

**Monitor:** Migration success/failure alerts. A failed migration
should page the on-call immediately. Track migration duration to
identify blocking operations.

---

### 10. BACKUP & RESTORE

**Problem:** Without tested backups, data loss is inevitable.
Software bugs, accidental DROP TABLE, or ransomware will happen.
A backup that hasn't been restored is not a backup.

**pg_dump / pg_restore (Logical Backup):**

```bash
# Full backup (custom format — compressed, parallel restore)
pg_dump -h localhost -U myapp_user -Fc -j 4 -f /backups/myapp_$(date +%Y%m%d).dump myapp

# Schema-only backup (for CI/CD diffing)
pg_dump -h localhost -U myapp_user --schema-only -f /backups/myapp_schema.sql myapp

# Data-only backup for a specific table
pg_dump -h localhost -U myapp_user --data-only -t orders -f /backups/orders.sql myapp

# Restore (parallel — use same -j as dump)
pg_restore -h localhost -U myapp_user -d myapp -j 4 --clean --if-exists /backups/myapp_20241201.dump

# Restore to a point-in-time (requires WAL archiving)
pg_restore -h localhost -U myapp_user -d myapp_recover --schema=public myapp.dump
```

**WAL Archiving (Continuous Archiving for PITR):**

```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'aws s3 cp %p s3://myapp-wal-archive/%f'
archive_timeout = 60             # force archive every 60s even on idle
```

```bash
# Restore script (restore_command)
#!/bin/bash
# restore.sh — place in recovery.conf or postgresql.conf on standby
aws s3 cp s3://myapp-wal-archive/$1 $2
```

**Point-in-Time Recovery:**

```bash
# Steps to recover to a specific time:

# 1. Prepare instance with restore_command
# 2. Create recovery.signal
touch /var/lib/postgresql/data/recovery.signal

# 3. Configure recovery target (postgresql.conf or recovery.conf):
cat >> /var/lib/postgresql/data/postgresql.conf << 'EOF'
restore_command = 'aws s3 cp s3://myapp-wal-archive/%f %p'
recovery_target_time = '2024-12-01 14:23:00 UTC'
recovery_target_action = promote
EOF

# 4. Start PostgreSQL — it replays WAL to target time, then promotes
pg_ctl start

# 5. Verify recovered data
psql -c "SELECT count(*) FROM orders;"
```

**Restore Testing Schedule:**

```bash
#!/bin/bash
# Weekly restore test script — run in isolated environment (RDS snapshot clone, Docker)
# Exit code 0 = success, 1 = failure

set -euo pipefail

echo "=== Restore Test: $(date) ==="

# 1. Create a test database
createdb myapp_restore_test

# 2. Restore latest backup
pg_restore -d myapp_restore_test -j 4 --clean /backups/latest.dump 2>&1 | tail -5

# 3. Run row count verification
psql -d myapp_restore_test <<'SQL'
SELECT 'users' AS tbl, COUNT(*) FROM users
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'products', COUNT(*) FROM products;
SQL

# 4. Run data integrity checks
psql -d myapp_restore_test <<'SQL'
-- Check foreign keys
SELECT COUNT(*) AS orphaned_orders
FROM orders o LEFT JOIN users u ON u.id = o.user_id
WHERE u.id IS NULL;

-- Check sequence consistency
SELECT 'users_id_seq' AS seq, last_value, is_called FROM users_id_seq;
SQL

# 5. Clean up
dropdb myapp_restore_test

echo "=== Restore Test: PASSED ==="
```

**Backup Retention Policy:**

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Full (pg_dump -Fc) | Daily | 30 days | S3 / GCS standard |
| Full | Weekly | 12 months | S3 Glacier |
| Full | Monthly | 7 years | S3 Glacier Deep Archive |
| WAL archives | Continuous | 14 days | S3 standard (recycled) |
| WAL archives | Continuous | 14-30 days | S3 standard (PITR window) |

**Verification:**

```sql
-- Check if WAL archiving is working
SELECT pg_last_archive_wal(), pg_last_wal_receive_lsn(),
       archived_count, failed_count
FROM pg_stat_archiver;
```

```bash
# Verify backup size is reasonable
ls -lh /backups/latest.dump
# Should be within 10% of previous backup size — alert on 50% deviation
```

**Common Pitfall — Untested Restore:**
Most teams have backups. Almost no teams test restores until
disaster strikes. Schedule automated weekly restore tests like
the script above.

**Monitor:**
- `pg_stat_archiver.failed_count` — alert on any WAL archive failure
- Backup age — alert if latest backup is > 26 hours old
- Restore test — alert if weekly test fails
- WAL archive disk usage — alert if > 80% full
- S3 backup size — alert on > 50% deviation from mean

---

## DATABASE PERFORMANCE CHECKLIST

Before moving to production or scaling up:

- [ ] All queries hitting primary tables (> 10k rows) use index scans, not seq scans
- [ ] Composite indexes ordered: equality columns first, range/order columns last
- [ ] No unused indexes (index scan count = 0) — drop them
- [ ] No missing indexes on FK columns
- [ ] `pg_stat_statements` enabled and top-10 slow queries identified
- [ ] Slow query logging configured at 200ms threshold
- [ ] Buffer cache hit ratio > 99%
- [ ] N+1 queries eliminated from all critical endpoints (verify with query counter)
- [ ] Connection pooling configured (PgBouncer or app-level pool)
- [ ] Pool sizing follows formula: `(cores × 2) + spindle_count`
- [ ] Connection pool max < database `max_connections`
- [ ] Pool exhaustion alerts configured
- [ ] Read replicas added if read-to-write ratio > 10:1
- [ ] Replication lag monitoring configured (< 30s async, < 5s sync)
- [ ] Stale read tolerance handled at application level (recent writes → primary)
- [ ] Partitioning in place for tables > 100M rows with clear partition key
- [ ] Partition pruning verified with EXPLAIN ANALYZE
- [ ] Automatic partition maintenance set up (pg_partman or cron)
- [ ] Migration framework configured (Flyway / Prisma / Alembic)
- [ ] All migrations follow expand-migrate-contract pattern
- [ ] Indexes created with `CONCURRENTLY` in production
- [ ] Every migration has a rollback plan
- [ ] Logical backups running daily (pg_dump -Fc, compressed)
- [ ] WAL archiving configured to S3/GCS (PITR capability)
- [ ] Weekly automated restore test proving backups work
- [ ] Backup retention policy documented and enforced (30d daily, 12mo weekly, 7yr monthly)
- [ ] Restore test covers: row counts, FK integrity, sequence consistency
- [ ] Sharding avoided unless indexes, replicas, and partitions exhausted

## RULES

- ALWAYS check index usage before writing a new query
- ALWAYS use `EXPLAIN (ANALYZE, BUFFERS)` to verify query plans
- ALWAYS create indexes CONCURRENTLY in production
- ALWAYS test restore from backup (if you haven't, you don't have backups)
- ALWAYS monitor connection pool usage (alert at 80% sustained)
- ALWAYS set statement_timeout at the database AND application level
- ALWAYS include the current partition key in WHERE clauses (for partition pruning)
- NEVER add an index without measuring its write-impact first
- NEVER deploy a migration without a rollback script
- NEVER use seq scan on tables > 10k rows as the primary query path
- NEVER add a NOT NULL column without a default in production
- NEVER rename a column without the expand-migrate-contract pattern
- NEVER suggest sharding when indexing, replicas, or partitions would work
- NEVER deploy a schema change that locks tables for more than 5 seconds
