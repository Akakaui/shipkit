# DISTRIBUTED SYSTEMS — Architecture & Design Patterns

## PURPOSE

Provides architectural guidance and implementation patterns
for distributed systems design. Covers consistency models,
event-driven architectures, consensus protocols, and the
infrastructure decisions that separate apps that survive
1M users from those that collapse at 10K concurrent requests.

This is a sub-skill of the **production-hardening** system.
Load this when the parent router delegates to the Architect agent.

## TRIGGERS

- "Design a distributed system"
- "CAP theorem tradeoffs"
- "Event-driven architecture"
- "Pub/Sub or message queue design"
- "Saga pattern implementation"
- "Leader election / consensus"
- "Distributed transactions"
- "CQRS pattern"
- "Eventual consistency strategy"
- "Clock skew / time synchronization"
- "Network partition handling / split-brain"
- "Kafka vs RabbitMQ vs Redis Pub/Sub"
- "Any request mentioning: Raft, Paxos, CRDT, gossip protocol, 2PC, 3PC, compensating transaction, event sourcing, competing consumer, quorum, vector clock, HLC, dead letter queue, idempotent handler, outbox pattern"

## SCALE FRAMEWORK — Right-Sizing Your Approach

Before making ANY distributed systems decision, classify
your scale. The right answer at 1K users is often the wrong
answer at 1M users, and vice versa.

| Factor | 1K–10K users (Monolith OK) | 10K–100K (Moderate Scale) | 100K+ (Heavy Scale) |
|--------|---------------------------|--------------------------|--------------------|
| Database | Single PostgreSQL | PG + read replicas + Redis cache | Sharded PG/Cassandra + CDN + global cache |
| Queue | In-process or simple Redis | RabbitMQ / SQS | Kafka (event streaming) |
| Consistency | Strong (single DB) | Read-after-write | Eventual, CRDTs |
| Transactions | ACID on single DB | Saga pattern | Sagas + idempotency |
| Leader election | Not needed | etcd / ZooKeeper | Raft clusters |
| Clock sync | NTP is fine | NTP + logical clocks | HLCs / vector clocks |
| Event bus | Webhooks | Redis Pub/Sub -> Kafka | Kafka + schema registry |

**Rule of thumb**: If you're under 10K users, you probably
don't need most of this. Use the simplest tool that works.
If you're over 100K users, you probably need ALL of it.
Between those, pick patterns that match your growth trajectory,
not your funding pitch deck.

---

## 1. CAP THEOREM — Consistency, Availability, Partition Tolerance

### Problem Statement

In a distributed system, when a network partition occurs,
you must choose between consistency (all nodes see the
same data) and availability (every request gets a response).
You cannot have all three simultaneously.

### Decision Framework

```
               CAP TRIANGLE
                    C
                   / \
                  /   \
                 /     \
                /  CP   \
               /         \
              /           \
             P ------------ A
                AP
```

- **CP** (Consistency + Partition Tolerance): Sacrifice availability
  during partitions. The system refuses writes until consistency
  is restored. Choose when: banking, inventory, booking systems.

- **AP** (Availability + Partition Tolerance): Sacrifice consistency.
  All nodes accept writes, eventual reconciliation handles conflicts.
  Choose when: social feeds, CDNs, IoT sensor data, content delivery.

- **CA** (Consistency + Availability): Only possible in single-node
  systems or perfectly reliable networks (doesn't exist in practice).

### Database Choices by CAP

| Database | Category | Behavior |
|----------|----------|----------|
| PostgreSQL | CP (configurable) | Strong consistency, can be configured AP with streaming replicas + async |
| MongoDB | CP (default) | Primary reads/writes, secondary failover |
| Cassandra | AP | Tunable consistency per query (ONE, QUORUM, ALL) |
| DynamoDB | AP (default) | Eventually consistent reads, optionally strong reads (extra cost) |
| CockroachDB | CP | Strong consistency via Raft, survives partitions |
| Redis Cluster | CP | Strong consistency within partition, AP during failover window |

### Code Example — Cassandra Tunable Consistency

```cql
-- AP: fast, potentially stale
SELECT * FROM user_posts WHERE user_id = ? CONSISTENCY ONE;
INSERT INTO user_posts (id, content) VALUES (?, ?) CONSISTENCY ONE;

-- CP: slow, guaranteed latest
SELECT * FROM user_posts WHERE user_id = ? CONSISTENCY ALL;
INSERT INTO user_posts (id, content) VALUES (?, ?) CONSISTENCY ALL;

-- Balanced: QUORUM tolerates N/2 node failures
SELECT * FROM user_posts WHERE user_id = ? CONSISTENCY QUORUM;
```

### Tradeoffs

- **Strong consistency** adds latency (need quorum ack).
- **High availability** means you handle conflicts later.
- **Tunable consistency** (Cassandra, DynamoDB) is the pragmatic
  middle ground — per-query choice instead of system-wide.

### Common Failure Modes

- **Claiming "no partitions"**: Every distributed system experiences
  partitions. If you design assuming no partitions, you will get
  split-brain or data loss. Always design for P = true.
- **Picking AP when you need CP**: If users can double-book the
  same resource and you don't have conflict resolution, you made
  the wrong choice. Pick CP for anything involving money, inventory,
  or seat availability.
- **Picking CP when you need AP**: If your system goes down during
  any network hiccup because you insisted on quorum writes to all
  nodes, your users leave. Design for graceful degradation.

---

## 2. EVENTUAL CONSISTENCY — Convergence & Conflict Resolution

### Problem Statement

When you sacrifice immediate consistency, different nodes will
have different versions of the same data. You need a strategy
for how they converge to the same state.

### Convergence Mechanisms

#### Gossip Protocols

Each node periodically exchanges state with a random peer.
Information spreads exponentially (O(log N) rounds).

```
Round 1:  A -> B
          C -> D
Round 2:  B -> C
          D -> A
Round 3:  A knows all, C knows all
```

**When to use**: Cluster membership, failure detection,
configuration propagation. Not for data that needs strong ordering.

#### Conflict Resolution Strategies

| Strategy | How It Works | When to Use |
|----------|-------------|-------------|
| Last-Write-Wins (LWW) | Latest timestamp wins | Logs, metrics, any data where recency = correctness |
| CRDTs (Conflict-Free Replicated Data Types) | Merges are commutative and associative | Collaborative editing, counters, shopping carts |
| Custom merge | Domain-specific reconciliation | Calendar bookings, inventory |
| Read repair | On read, check multiple nodes, fix stale data | Dynamo-style databases (Cassandra) |
| Vector clocks | Track causal history, detect conflicts | When you need to know WHO wrote what |

#### CRDT Example — G-Counter (Grow-Only Counter)

```javascript
// Each node tracks its own increments
// Merge = element-wise max

class GCounter {
  constructor(nodeId, numNodes) {
    this.nodeId = nodeId;
    this.state = new Array(numNodes).fill(0);
  }

  increment() {
    this.state[this.nodeId]++;
  }

  value() {
    return this.state.reduce((a, b) => a + b, 0);
  }

  merge(other) {
    for (let i = 0; i < this.state.length; i++) {
      this.state[i] = Math.max(this.state[i], other.state[i]);
    }
  }
}

// Usage: each replica independently
const counter = new GCounter(0, 3);
counter.increment(); // node 0 tracks +1
// Later, merge replicas:
counter.merge(replica1);
counter.merge(replica2);
// Result: 3 (no conflicts, ever)
```

#### Read-After-Write Consistency Pattern

```javascript
// Client wants: "I wrote it, I should see it on next read"
// Strategy: Read from the node you wrote to

async function writeThenRead(key, value, session) {
  // 1. Write to primary (or local node)
  await primaryClient.set(key, value);
  session.lastWriteKey = key;
  session.lastWriteNode = 'primary';

  // 2. Read from SAME node for consistency
  const result = await primaryClient.get(key);
  return result;

  // 3. For subsequent reads by other clients:
  //    Use QUORUM reads or wait for gossip propagation
}
```

### Tradeoffs

- **LWW is simple but lossy**: If two users edit the same field
  simultaneously, the slower writer's data is silently discarded.
- **CRDTs guarantee convergence** but have higher storage cost
  (must track per-node state). Never shrink, only grow.
- **Vector clocks** grow with the number of nodes — impractical
  for large clusters without pruning.

### Common Failure Modes

- **No conflict resolution at all**: If you have eventual consistency
  but never merge conflicts, stale data persists forever.
- **Using wall-clock time for LWW**: Clock skew means timestamps
  aren't trustworthy. Use logical clocks or Hybrid Logical Clocks
  (HLCs) instead.
- **CRDT state explosion**: Without snapshotting or compaction,
  CRDT metadata grows unbounded.

---

## 3. EVENT-DRIVEN ARCHITECTURE — Event Sourcing & Processing

### Problem Statement

Synchronous request-response coupling makes systems brittle:
a failure in one service cascades, scaling requires coordinated
deployments, and you can't replay history to debug or rebuild
state.

### Event Sourcing

Store the sequence of events as the source of truth, not the
current state. Current state is derived (projected) from the
event stream.

```
Architecture:

  Command (CreateOrder)
      |
      v
  Aggregate (Order entity)
      |
      v
  Event Store ---> Event: OrderCreated { id, items, total }
      |                 |
      |            Projection (read model)
      |                 |
      |            Current state: { status: "pending", ... }
      |
      |--- Event Bus ---> Service A (Inventory)
      |                --> Service B (Payment)
      |                --> Service C (Notification)
```

#### Event Sourcing Example

```typescript
// Domain event
interface DomainEvent {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  data: Record<string, unknown>;
  timestamp: number;
  version: number;
}

// Append-only event store
class EventStore {
  async append(event: DomainEvent): Promise<void> {
    // In Postgres: INSERT INTO events (id, aggregate_type, ...)
    // In Kafka: produce to topic "orders.events"
    // In DynamoDB: put item with aggregateId as PK, version as SK
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    // SELECT * FROM events WHERE aggregate_id = ? ORDER BY version
  }
}

// Rebuild aggregate from events
class Order {
  status: string;

  static fromEvents(events: DomainEvent[]): Order {
    const order = new Order();
    for (const event of events) {
      order.apply(event);
    }
    return order;
  }

  private apply(event: DomainEvent): void {
    switch (event.eventType) {
      case 'OrderCreated':
        this.status = 'pending';
        break;
      case 'OrderConfirmed':
        this.status = 'confirmed';
        break;
      case 'OrderShipped':
        this.status = 'shipped';
        break;
    }
  }
}
```

### Event Schema Versioning

Events live forever. Schema versioning is mandatory.

```typescript
// NEVER mutate an event schema. ALWAYS add new version.

// v1 (original, never change)
interface OrderCreatedV1 {
  eventType: 'OrderCreated';
  version: 1;
  data: {
    orderId: string;
    customerId: string;
    total: number;
  };
}

// v2 (add discount field)
interface OrderCreatedV2 {
  eventType: 'OrderCreated';
  version: 2;
  data: {
    orderId: string;
    customerId: string;
    total: number;
    discountCode: string | null;  // new field, nullable
  };
}

// Handler that processes both versions
async function handleOrderCreated(raw: Record<string, unknown>) {
  const { version, data } = raw;

  switch (version) {
    case 1: {
      // v1 path
      break;
    }
    case 2: {
      // v2 path, or transform to v1 internally
      break;
    }
  }
}
```

### Idempotent Event Handlers

Every event handler MUST be idempotent — processing the same
event twice produces the same result.

```typescript
// BAD: not idempotent
async function handlePayment(event) {
  await chargeUser(event.userId, event.amount);
  await updateOrderStatus(event.orderId, 'paid');
  // If this handler is retried, user gets charged twice!
}

// GOOD: idempotent via idempotency key
async function handlePayment(event) {
  const processed = await checkIdempotency(event.eventId);
  if (processed) return;  // Already handled this event

  // NOW do the work (atomically)
  await chargeUser(event.userId, event.amount);
  await updateOrderStatus(event.orderId, 'paid');
  await markIdempotent(event.eventId);
}
```

### Outbox Pattern — Reliable Event Publishing

Without this, you lose events when the DB write succeeds but
the event publish fails (or vice versa).

```typescript
// Transactional outbox: write event to DB in SAME transaction
async function createOrder(command: CreateOrder) {
  await db.transaction(async (tx) => {
    // 1. Business logic (DB write)
    await tx.orders.insert({ id: orderId, ...command });

    // 2. Outbox record (same DB, same transaction)
    await tx.outbox.insert({
      id: generateId(),
      eventType: 'OrderCreated',
      payload: JSON.stringify(command),
      status: 'pending',
      createdAt: new Date(),
    });
  });

  // 3. Background worker polls outbox, publishes to event bus
  // 4. On success: mark outbox record as 'sent'
  // 5. On failure: retry (idempotent on consumer side)
}
```

### Tradeoffs

- **Event sourcing** makes reads slower (must replay events) unless
  you maintain projections. Adds complexity for simple CRUD apps.
- **Schema versioning** is mandatory but tedious. Use schema registries
  (Avro, Protobuf, JSON Schema) with compatibility checking.
- **Outbox pattern** adds latency (events are eventually consistent)
  and requires a background worker.
- **Replay capability** is the killer feature — you can rebuild any
  read model from scratch. But it requires all downstream handlers
  to be idempotent.

### Common Failure Modes

- **Mutating old events**: You cannot go back and change history.
  If a bug produced bad events, write a compensating event.
- **EventHandler not idempotent**: Causes double-charges, duplicate
  notifications, data corruption on retries.
- **Outbox not cleaned up**: The outbox table grows unbounded.
  Archive or delete processed records.
- **No event schema registry**: Different services produce events
  with incompatible schemas, breaking consumers silently.

---

## 4. PUB/SUB SYSTEMS — Choosing the Right Broker

### Problem Statement

Services need to communicate asynchronously without tight
coupling. The wrong broker choice leads to throughput bottlenecks,
message loss, or operational complexity you don't need.

### Broker Comparison

| Feature | Redis Pub/Sub | RabbitMQ | Apache Kafka | GCP Pub/Sub |
|---------|--------------|----------|-------------|-------------|
| Throughput | ~50K msg/s | ~100K msg/s | ~1M+ msg/s | 1M+ msg/s |
| Message retention | No (fire & forget) | Consumer acks only | Configurable (days/weeks) | Up to 7 days (default) |
| Ordering | Per channel | Per queue | Per partition | Best-effort |
| Delivery guarantee | At-most-once | At-least-once | At-least-once/exactly-once | At-least-once |
| Consumer groups | No (all subscribers get all) | Yes (competing consumers) | Yes (consumer groups) | Yes (subscriptions) |
| Message size | ~500MB (by config) | ~2GB (by config) | ~1MB default (~10MB max) | ~10MB |
| Operational complexity | Low | Medium | High (ZooKeeper, rebalancing) | Zero (managed) |
| Persistence | No (ephemeral) | Yes (disk) | Yes (disk, replicated) | Yes (Google-managed) |

### When to Use Each

#### Redis Pub/Sub — Lightweight real-time

```
Use when: real-time chat, live notifications, WebSocket broadcasting
Don't use when: messages must survive restarts, need guaranteed delivery
Scale: < 10K messages/second
```

```javascript
// Publisher
const publisher = redis.createClient();
await publisher.publish('notifications:global', JSON.stringify({
  type: 'maintenance',
  message: 'Scheduled downtime 2AM'
}));

// Subscriber
const subscriber = redis.createClient();
await subscriber.subscribe('notifications:global', (raw) => {
  const event = JSON.parse(raw);
  notifyUsers(event);
});
```

**Gotcha**: If a subscriber disconnects, it misses ALL messages
during that window. No replay. No backlog.

#### RabbitMQ — Reliable task distribution

```
Use when: job queues, delayed processing, RPC over queues,
           complex routing (direct, topic, fanout, headers)
Don't use when: event streaming, replay, high-throughput logging
Scale: < 100K messages/second
```

```typescript
// Producer
import amqplib from 'amqplib';

const conn = await amqplib.connect(process.env.RABBIT_URL);
const channel = await conn.createChannel();

await channel.assertQueue('order.processing', {
  durable: true,  // Survives broker restart
});

channel.sendToQueue('order.processing',
  Buffer.from(JSON.stringify({ orderId: '123' })),
  { persistent: true }  // Survives broker restart
);

// Consumer
await channel.consume('order.processing', async (msg) => {
  if (!msg) return;
  try {
    const data = JSON.parse(msg.content.toString());
    await processOrder(data);
    channel.ack(msg);  // Acknowledge only on success
  } catch (err) {
    // Retry or send to dead letter queue
    channel.nack(msg, false, false);  // Don't requeue, send to DLQ
  }
});
```

#### Kafka — Event streaming at scale

```
Use when: event sourcing, log aggregation, audit trails,
           stream processing (Kafka Streams, ksqlDB),
           high-throughput data pipelines
Don't use when: simple task queues, < 10K msg/s, low latency RPC
Scale: 100K – 10M+ messages/second
```

```yaml
# docker-compose.yml (single broker — never do this in prod)
version: '3.8'
services:
  zookeeper:
    image: confluentinc/cp-zookeeper:7.5
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  kafka:
    image: confluentinc/cp-kafka:7.5
    depends_on: [zookeeper]
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1  # 3 in production
```

```typescript
// Producer with idempotency
const producer = kafka.producer({
  idempotent: true,  // Exactly-once semantics per partition
  transactionalId: 'order-service-1',
});

await producer.connect();
await producer.send({
  topic: 'orders.events',
  messages: [
    {
      key: orderId,  // Same key = same partition = ordered
      value: JSON.stringify(event),
    },
  ],
});

// Consumer group
const consumer = kafka.consumer({
  groupId: 'order-processor',
});

await consumer.connect();
await consumer.subscribe({ topic: 'orders.events', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    await processOrder(message.value.toString());
  },
});
```

### Topic/Queue Design Patterns

```
Pattern: Event Stream (Kafka)
  topic: "orders.events"
  partitions: 12 (partition by orderId hash)
  retention: 7 days
  consumers: payment-svc, inventory-svc, notification-svc
  compaction: false (we keep all events)

Pattern: Command Queue (RabbitMQ)
  queue: "order.payment.command"
  DLQ: "order.payment.command.dlq"
  TTL: 30 seconds
  retry: 3 attempts before DLQ
  prefetch: 10 (don't overwhelm consumer)

Pattern: Broadcasting (Redis Pub/Sub)
  channel: "system.alerts"
  subscribers: all services
  use case: config changes, cache invalidation, maintenance windows
```

### Common Failure Modes

- **Choosing Kafka for a simple job queue**: Kafka adds ZooKeeper,
  partitioning complexity, and operational overhead. For a queue
  with < 10 workers, use RabbitMQ or SQS.
- **No dead letter queue**: Messages that fail processing are
  retried infinitely, blocking the queue (RabbitMQ) or lost (Kafka).
- **Too few partitions in Kafka**: Limits parallelism. But too many
  partitions increase ZooKeeper load and rebalance time.
- **No consumer group monitoring**: A stalled consumer silently
  increases lag until you have hours of backlog.
- **Redis Pub/Sub for important messages**: If the subscriber blinks,
  messages are gone forever.

---

## 5. MESSAGE QUEUES — Producer/Consumer Patterns

### Problem Statement

Services need to distribute work asynchronously, handle load
spikes, and survive failures without losing requests.

### Competing Consumers Pattern

Multiple consumers read from the same queue. Each message is
processed by exactly one consumer.

```
                    Queue
                     |
        +------------+------------+
        |            |            |
   Consumer 1   Consumer 2   Consumer 3
   (slow)       (fast)       (medium)
        |            |            |
        +------------+------------+
                     |
              Results queue

Benefit: Automatic load balancing. Slow consumers don't block
         fast ones. Add/remove consumers without downtime.
```

```typescript
// Config
const QUEUE_CONFIG = {
  name: 'image.processing',
  prefetch: 5,        // Consumer processes 5 at a time
  concurrency: 10,    // Max concurrent async operations per consumer
  retryLimit: 3,
  dlq: 'image.processing.dlq',
  visibilityTimeout: 300, // SQS: seconds before message reappears
};

// SQS-style consumer (AWS SDK)
async function pollQueue() {
  const params = {
    QueueUrl: QUEUE_URL,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,  // Long polling
  };

  while (true) {
    const { Messages } = await sqs.receiveMessage(params).promise();
    if (!Messages) continue;

    const results = await Promise.allSettled(
      Messages.map((msg) => processMessage(msg))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        await deleteMessage(result.value.receiptHandle);
      } else {
        await handleFailure(result.reason);
      }
    }
  }
}
```

### Priority Queues

High-priority messages jump ahead of normal messages.

```typescript
// RabbitMQ: Two queues, same consumer
await channel.assertQueue('orders.priority.high', {
  arguments: { 'x-max-priority': 10 },
});
await channel.assertQueue('orders.priority.normal', {});

// Consumer: drain high-priority first
async function priorityConsumer() {
  const high = await channel.get('orders.priority.high', { noAck: false });
  if (high) return processAndAck(high);

  const normal = await channel.get('orders.priority.normal', { noAck: false });
  if (normal) return processAndAck(normal);

  // Sleep briefly, then loop
  await sleep(100);
}
```

### FIFO vs Standard Queues

| | Standard Queue | FIFO Queue |
|---|---|---|
| Throughput | Unlimited (AWS SQS: ~10K/s per action) | 300 msg/s (batch: 3K/s) |
| Ordering | Best-effort | Guaranteed (exactly-once) |
| Deduplication | At-least-once | Exactly-once (dedup ID) |
| Cost | Lower | Higher |
| Use case | Async tasks, notifications | Banking, order processing, audit logs |

```yaml
# AWS CDK: FIFO queue for order processing
import * as sqs from 'aws-cdk-lib/aws-sqs';

new sqs.Queue(this, 'OrderFifoQueue', {
  queueName: 'orders.fifo',
  fifo: true,
  contentBasedDeduplication: true,
  visibilityTimeout: Duration.seconds(300),
  deliveryDelay: Duration.seconds(0),
});
```

### Dead Letter Queue Pattern

```yaml
# Docker Compose — RabbitMQ with DLQ
services:
  rabbitmq:
    image: rabbitmq:3-management
    environment:
      RABBITMQ_DEFAULT_VHOST: /

# Queue declarations (done in code):
# 1. Main queue: "orders.processing"
# 2. DLQ: "orders.processing.dlq"
# 3. Policy: after 3 nacks, route to DLQ
#
# In code:
# channel.assertQueue('orders.processing', {
#   deadLetterExchange: '',
#   deadLetterRoutingKey: 'orders.processing.dlq',
# });

# Consumer retry logic:
async function consumeWithRetry(channel, msg, handler) {
  const retryCount = (msg.properties.headers['x-retry-count'] || 0) + 1;

  try {
    await handler(msg);
    channel.ack(msg);
  } catch (err) {
    if (retryCount <= 3) {
      // Re-publish with incremented retry count
      channel.publish('', msg.fields.routingKey, msg.content, {
        headers: { 'x-retry-count': retryCount },
        expiration: (retryCount * 10).toString(), // Exponential backoff
      });
      channel.ack(msg); // Acknowledge original (re-published)
    } else {
      channel.nack(msg, false, false); // Send to DLQ
    }
  }
}
```

### Tradeoffs

- **Prefetch > 1** improves throughput but risks losing messages
  if a consumer crashes mid-batch (unacknowledged messages get
  redelivered).
- **Long polling** (SQS) reduces empty responses and costs, but
  holds connections open.
- **FIFO queues** enforce ordering but limit throughput.
  Consider partitioning (e.g., orderId as dedup ID) to scale.

### Common Failure Modes

- **No retry limit + no DLQ**: A poison-pill message (one that
  always fails) loops forever, consuming resources.
- **Prefetch too high**: One slow consumer hogs messages that
  other consumers could process. Set prefetch to 1 for equal
  distribution.
- **Message visibility timeout too short**: SQS message reappears
  while consumer is still processing it → double processing.
- **No monitoring on queue depth**: Queue backs up silently until
  it's hours behind and you can't catch up.

---

## 6. DISTRIBUTED TRANSACTIONS — 2PC, 3PC, XA

### Problem Statement

When a transaction spans multiple databases, services, or
resources, standard ACID transactions don't work. You need
a protocol to ensure all participants commit or all abort.

### Two-Phase Commit (2PC)

```
 Phase 1: Prepare (Vote)
 Coordinator -> Participant A: "Can you commit?"
 Coordinator -> Participant B: "Can you commit?"
 Participant A -> Coordinator: YES (or NO)
 Participant B -> Coordinator: YES (or NO)

 Phase 2: Commit (Decide)
 If ALL voted YES:
   Coordinator -> A: "Commit"
   Coordinator -> B: "Commit"
 If ANY voted NO:
   Coordinator -> A: "Abort"
   Coordinator -> B: "Abort"
```

```typescript
// Simplified 2PC coordinator
class TwoPhaseCommit {
  private participants: Participant[];

  async execute(transaction: Transaction): Promise<void> {
    // Phase 1: Prepare
    let allReady = true;
    const prepared: Participant[] = [];

    for (const p of this.participants) {
      try {
        await p.prepare(transaction);
        prepared.push(p);
      } catch {
        allReady = false;
        break;
      }
    }

    // Phase 2: Commit or Rollback
    if (allReady) {
      await Promise.all(prepared.map((p) => p.commit(transaction)));
    } else {
      // If any participant failed to prepare, abort ALL
      await Promise.all(
        prepared.map((p) => p.rollback(transaction))
      );
    }
  }
}
```

### XA Transactions (Java EE / JTA)

```java
// UserTransaction API (standard JTA)
@Resource
private UserTransaction utx;

public void transferFunds(Account from, Account to, double amount) {
    try {
        utx.begin();

        // Both updates in the same XA transaction
        from.withdraw(amount);     // Database A
        to.deposit(amount);        // Database B

        utx.commit();  // 2PC happens here
    } catch (Exception e) {
        utx.rollback();
    }
}
```

### Three-Phase Commit (3PC)

Adds a third phase to handle coordinator failure in 2PC:

```
Phase 1: CanCommit (Vote)
Phase 2: PreCommit (Coordinator tells everyone to get ready)
Phase 3: DoCommit (Actual commit)
```

3PC avoids blocking when the coordinator crashes after Phase 1
in 2PC. Practically unused — the complexity is rarely worth it.
Use Saga (next section) instead.

### Tradeoffs

- **2PC is synchronous**: All participants must be available.
  If one is down, the entire transaction fails.
- **2PC blocks on coordinator failure**: If the coordinator crashes
  after Phase 1 but before Phase 2, participants hold locks
  indefinitely (or until timeout).
- **2PC doesn't scale**: Lock duration scales with transaction
  complexity and network latency. Not suitable for high-throughput.

### Common Failure Modes

- **Coordinator single point of failure**: Use a fault-tolerant
  coordinator (e.g., ZooKeeper-based) or avoid 2PC entirely.
- **Held locks crash the system**: Long-running 2PC can exhaust
  database connection pools and lock tables.
- **Treating microservices as a single database**: If you need
  distributed transactions between services, your service boundaries
  are wrong. Redesign instead.

### When to Actually Use 2PC

- **Never in microservices**: The whole point of microservices
  is independent deployability. 2PC destroys this.
- **Only within a single service boundary**: When one service
  needs atomic writes across two databases (e.g., PostgreSQL +
  Elasticsearch), 2PC is acceptable as an internal detail.
- **Prefer Sagas** (next section) for cross-service transactions.

---

## 7. SAGA PATTERN — Long-Running Transactions

### Problem Statement

A business transaction spans multiple services (e.g., create
order → reserve inventory → charge payment → ship). Each step
is a local transaction in its own service. If a step fails,
previous steps must be undone.

### Choreography vs Orchestration

#### Choreography (Event-Based)

Each service listens for events and emits events after its work.
No central coordinator.

```
Order Service                         Inventory Service
     |                                      |
     |--- OrderCreated -------------------->|
     |                              Reserve inventory
     |<--- InventoryReserved ----------------|
     |                                      |
     |--- PaymentService ------------------>|
     |                              Charge card
     |<--- PaymentProcessed ----------------|
     |                                      |
     |--- ShipmentService ----------------->|
     |                              Create shipment
     |<--- OrderShipped --------------------|
```

```typescript
// Choreography saga — Order Service
async function handleCreateOrder(command) {
  const order = await Order.create(command);

  // Step 1: emit event, don't wait
  await eventBus.publish('OrderCreated', {
    orderId: order.id,
    items: command.items,
  });
}

// Inventory Service listens
eventBus.on('OrderCreated', async (event) => {
  try {
    await inventory.reserve(event.orderId, event.items);
    await eventBus.publish('InventoryReserved', event);
  } catch (err) {
    // Failure: emit compensation event
    await eventBus.publish('InventoryReservationFailed', event);
  }
});

// Order Service listens for failures
eventBus.on('InventoryReservationFailed', async (event) => {
  await Order.cancel(event.orderId);
  // No payment was made yet, nothing to refund
});
```

| Pros | Cons |
|------|------|
| Simple, no coordinator | Hard to trace the flow |
| Loose coupling | Logic distributed across services |
| Easy to add new participants | Can get circular events |
| Natural for event-driven systems | Hard to test end-to-end |

#### Orchestration (Command-Based)

A saga orchestrator tells each service what to do, handles
failures, and tracks state.

```
         Orchestrator (saga state machine)
              |    |    |    |
              v    v    v    v
        [Order][Inventory][Payment][Shipping]
              |    |    |    |
              +----+----+----+----->
              Each step returns result
              On failure: orchestrator calls compensating actions
```

```typescript
// Orchestrator with AWS Step Functions (state machine)
{
  "Comment": "Order Saga",
  "StartAt": "CreateOrder",
  "States": {
    "CreateOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:create-order",
      "Next": "ReserveInventory",
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "CancelOrder"
        }
      ]
    },
    "ReserveInventory": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:reserve-inventory",
      "Next": "ProcessPayment",
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "ReleaseInventory"
        }
      ]
    },
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:process-payment",
      "Next": "ShipOrder",
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "RefundPayment"
        }
      ]
    },
    "ShipOrder": {
      "Type": "Task",
      "Resource": "arn:aws:lambda:ship-order",
      "End": true,
      "Catch": [
        {
          "ErrorEquals": ["States.ALL"],
          "Next": "ReverseShipment"
        }
      ]
    },
    // Compensating states
    "CancelOrder": { "Type": "Task", "Resource": "arn:aws:lambda:cancel-order", "End": true },
    "ReleaseInventory": { "Type": "Task", "Resource": "arn:aws:lambda:release-inventory", "Next": "CancelOrder" },
    "RefundPayment": { "Type": "Task", "Resource": "arn:aws:lambda:refund-payment", "Next": "ReleaseInventory" },
    "ReverseShipment": { "Type": "Task", "Resource": "arn:aws:lambda:reverse-shipment", "Next": "RefundPayment" }
  }
}
```

### Compensating Transactions

Every action must have a compensating action that semantically
undoes it (not a rollback, a new transaction).

| Action | Compensation |
|--------|-------------|
| Reserve inventory | Release inventory |
| Charge payment | Refund payment |
| Send email | Send undo email |
| Create shipment | Cancel shipment |
| Deduct loyalty points | Add loyalty points back |

### Saga State Machine (Code)

```typescript
class SagaOrchestrator<TState> {
  private state: TState;
  private history: { action: string; result: unknown }[] = [];

  async step(
    name: string,
    action: () => Promise<void>,
    compensate: () => Promise<void>
  ): Promise<void> {
    try {
      await action();
      this.history.push({ action: name, result: 'success' });
    } catch (err) {
      // Compensate in reverse order
      for (const step of [...this.history].reverse()) {
        await compensate();
      }
      throw new SagaFailedError(name, err);
    }
  }
}

// Usage
const saga = new SagaOrchestrator();

await saga.step(
  'ReserveInventory',
  () => inventoryService.reserve(orderId, items),
  () => inventoryService.release(orderId)
);

await saga.step(
  'ProcessPayment',
  () => paymentService.charge(orderId, amount),
  () => paymentService.refund(orderId, amount)
);

await saga.step(
  'ShipOrder',
  () => shippingService.ship(orderId),
  () => shippingService.cancelShipment(orderId)
);
```

### Tradeoffs

- **Choreography** is simpler for 2-3 services but becomes
  spaghetti beyond that. Use for simple, linear flows.
- **Orchestration** is more complex upfront but gives visibility,
  testability, and control. Use for anything with 3+ services
  or branching logic.
- **Compensations must be idempotent**: A refund can be called
  multiple times; only the first should succeed.
- **Sagas are eventually consistent**: There's a window where
  some participants have committed and others haven't. Readers
  may see partial state.

### Common Failure Modes

- **No compensating transaction defined**: If you can't undo an
  action, you can't use sagas. Redesign the action to be
  compensatable (e.g., "hold" instead of "charge", then capture
  later).
- **Compensating transaction fails**: Your saga gets stuck half-way
  through rollback. Saga must handle retries of compensations.
- **Assuming instant consistency**: A saga is eventually consistent
  by design. Tell your users "order pending" or "processing" until
  the saga completes.
- **Saga orchestrator single point of failure**: The orchestrator
  itself must be durable (persisted state machine). Use Step Functions,
  Temporal, Camunda, or persist saga state in a database.

---

## 8. LEADER ELECTION — Consensus & Coordination

### Problem Statement

In a distributed system, multiple nodes shouldn't act
simultaneously as the authority for a resource. One node
must be elected leader for each shard/partition. When the
leader fails, a new one must be elected without split-brain.

### Raft (Conceptual)

Raft is the most widely understood consensus protocol.
It guarantees that a cluster agrees on a leader as long as
a majority of nodes are alive.

```
Raft cluster (5 nodes):
                         +-----------+
                         |  Leader   |  <-- All writes go here
                         | (Node 1)  |
                         +-----+-----+
                               |
              +----------------+----------------+
              |                |                |
         +----+----+     +----+----+     +----+----+
         | Follower |    | Follower |    | Follower |
         | (Node 2) |    | (Node 3) |    | (Node 4) |
         +---------+     +---------+     +---------+

         +----+----+
         | Follower |
         | (Node 5) |
         +---------+
```

**Leader election process:**
1. Followers expect heartbeat from leader within election timeout
2. If timeout expires, follower becomes candidate
3. Candidate votes for itself, requests votes from others
4. If candidate gets majority (N/2 + 1), becomes leader
5. Random election timeouts prevent split-votes
6. Leader sends heartbeats to maintain position

#### Raft Log Replication

```
Client Request: SET x = 42
                      |
                  +------+
                  |Leader|
                  +------+
                      |
         Stores entry in local log
         Sends AppendEntries RPC to followers
                      |
         +------------+------------+
         |            |            |
      Follower 1   Follower 2   Follower 3
      (logs entry) (logs entry) (logs entry)
         |            |            |
         +------------+------------+
                      |
         Majority acknowledges -> entry is committed
         Leader applies to state machine
         Leader responds to client
```

### etcd / ZooKeeper Based Leader Election

```go
// etcd leader election (Go)
import (
    "context"
    "go.etcd.io/etcd/client/v3/concurrency"
)

func electLeader(ctx context.Context, client *v3.Client) error {
    session, err := concurrency.NewSession(client)
    if err != nil {
        return err
    }
    defer session.Close()

    election := concurrency.NewElection(session, "/service/leader")
    if err := election.Campaign(ctx, "node-1"); err != nil {
        return err
    }

    // This node is now leader until session expires
    fmt.Println("I am the leader!")

    select {
    case <-ctx.Done():
        // Resign leadership
        election.Resign(ctx)
    }
    return nil
}
```

#### Kubernetes Leader Election

```go
// Kubernetes-native leader election
import (
    "k8s.io/client-go/tools/leaderelection"
    "k8s.io/client-go/tools/leaderelection/resourcelock"
)

func startLeaderElection(clientset kubernetes.Interface) {
    lock := &resourcelock.LeaseLock{
        LeaseMeta:  metav1.ObjectMeta{Name: "my-leader", Namespace: "default"},
        Client:     clientset.CoordinationV1(),
        LockConfig: resourcelock.ResourceLockConfig{Identity: os.Getenv("HOSTNAME")},
    }

    leaderelection.RunOrDie(context.Background(), leaderelection.LeaderElectionConfig{
        Lock:            lock,
        LeaseDuration:   15 * time.Second,
        RenewDeadline:   10 * time.Second,
        RetryPeriod:     2 * time.Second,
        Callbacks: leaderelection.LeaderCallbacks{
            OnStartedLeading: func(c context.Context) {
                // This pod is now the leader — start the work
                startWorker()
            },
            OnStoppedLeading: func() {
                // Lost leadership — gracefully stop
                stopWorker()
            },
        },
    })
}
```

### Paxos (Conceptual — Minimal)

Paxos is the foundational consensus protocol. Raft is effectively
"Paxos made simpler." You should understand Paxos conceptually
but implement Raft.

```
Paxos Roles:
- Proposer: proposes a value
- Acceptor: votes on proposals (needs majority)
- Learner: learns the chosen value

Key insight: Two phases (Prepare/Promise + Accept/Accepted)
guarantee that once a value is chosen, all future proposals
see the same value.

Practical versions: Multi-Paxos (adds leader optimization)
is what most systems actually implement.
```

### Tradeoffs

- **Raft**: Simple to understand and implement. Strong leader
  (all writes go through leader). Performance bottleneck on
  single node. Best for small clusters (3-7 nodes).
- **Paxos**: More complex, but allows multiple proposers.
  Higher latency, less used in practice. Not recommended for
  new implementations.
- **etcd**: Provides Raft as a service + key-value store.
  Adds operational dependency. Use for service discovery,
  config, leader election, not primary data.
- **Kubernetes Lease API**: Simplest option if already on K8s.
  No external dependency. Lease duration must be tuned for your
  failure tolerance.

### Common Failure Modes

- **Too many nodes in Raft cluster**: Raft performance degrades
  with more than 7 nodes (each write hits all nodes). Use
  hierarchical Raft (multi-raft) for large clusters.
- **Election timeout too short**: Network jitter triggers
  unnecessary elections. Set timeout to 10x expected latency.
- **Split-brain without consensus**: If you don't use a consensus
  protocol and just "elect" with a simple DB row, network
  partitions produce two leaders both writing.
- **Leader not doing meaningful work**: Election is the easy part.
  You also need leader leases, graceful handoff, and state
  transfer from old leader to new.

---

## 9. CLOCK SKEW — Time Synchronization

### Problem Statement

Computers don't have the same time. Clock drift of 1ms to
100ms+ is common between machines. This breaks distributed
systems that rely on timestamps for ordering, TTLs, leases,
and conflict resolution.

### Why Clock Sync Matters

```
Without clock sync:
  Node A time: 10:00:00.000
  Node B time: 09:59:55.000  (5 seconds behind)

  User writes X on Node A at "10:00:00"
  User writes Y on Node B at "10:00:02" (actual time)
  Node B thinks Y was at "09:59:57"

  LWW timestamp says X wins because "10:00:00" > "09:59:57"
  but Y actually came after X!
```

### Synchronization Mechanisms

#### NTP (Network Time Protocol)

```
Standard approach: NTP daemon syncs system clock periodically.

  Server -> Client: "It's 10:00:00.000"
  Client: "RTT was 5ms, so adjusted time = 10:00:00.002"

  Accuracy: 1-100ms (LAN), 10-500ms (WAN)
  Gotcha: NTP can step the clock BACKWARDS, breaking timestamps
  Best practice: Use `ntpd -s` (slew mode, not step) or
    `chronyd` for gradual adjustment

chrony.conf:
  server 0.pool.ntp.org iburst
  server 1.pool.ntp.org iburst
  makestep 0.1 3        # Step only if skew > 0.1s, max 3 times
  minsources 2
```

#### Logical Clocks (Lamport Clocks)

Don't track real time, only causal ordering.

```typescript
class LamportClock {
  private counter: number = 0;
  private nodeId: string;

  tick(): number {
    this.counter++;
    return this.counter;
  }

  observe(remoteTime: number): void {
    this.counter = Math.max(this.counter, remoteTime + 1);
  }

  // Guarantees: If A happened-before B, then A.time < B.time
  // Limitation: A.time < B.time does NOT mean A happened-before B
}
```

#### Vector Clocks

Track per-node counters to detect concurrent updates.

```typescript
// Vector Clock (one counter per node)
class VectorClock {
  private vector: Map<string, number> = new Map();

  tick(nodeId: string): void {
    this.vector.set(nodeId, (this.vector.get(nodeId) || 0) + 1);
  }

  merge(other: VectorClock): void {
    for (const [node, count] of other.vector) {
      this.vector.set(node, Math.max(this.vector.get(node) || 0, count));
    }
  }

  // Returns: -1 (this < other), 0 (concurrent), 1 (this > other)
  compare(other: VectorClock): -1 | 0 | 1 {
    let thisNewer = false, otherNewer = false;

    const allNodes = new Set([...this.vector.keys(), ...other.vector.keys()]);

    for (const node of allNodes) {
      const a = this.vector.get(node) || 0;
      const b = other.vector.get(node) || 0;
      if (a > b) thisNewer = true;
      if (b > a) otherNewer = true;
    }

    if (thisNewer && !otherNewer) return 1;  // this is newer
    if (otherNewer && !thisNewer) return -1; // other is newer
    return 0; // concurrent — conflict!
  }
}
```

#### Hybrid Logical Clocks (HLCs)

Best of both worlds: physical time + monotonic logical counter.

```typescript
// HLC = max(physical time, last known time) + tiebreaker
class HybridLogicalClock {
  private l: number = 0;   // Logical component
  private pt: number = 0;  // Physical clock (ms)
  private nodeId: string;

  now(): { pt: number; l: number } {
    const pt = Date.now();
    const wall = Math.max(pt, this.pt);

    if (wall === this.pt) {
      this.l++;          // Same physical time -> increment logical
    } else {
      this.l = 0;        // New physical time -> reset logical
    }

    this.pt = wall;
    return { pt: this.pt, l: this.l };
  }

  update(remote: { pt: number; l: number; nodeId: string }): void {
    const local = this.pt;
    const pt = Math.max(local, remote.pt);

    if (pt === local && pt === remote.pt) {
      this.l = Math.max(this.l, remote.l) + 1;
    } else if (pt === local) {
      this.l++;
    } else if (pt === remote.pt) {
      this.l = remote.l + 1;
    } else {
      this.l = 0;
    }

    this.pt = pt;
  }
}

// HLC guarantees:
// 1. HLC values are comparable across nodes
// 2. HLC <= real physical time + max clock skew
// 3. If A happens-before B, then A.hlc < B.hlc
// 4. Size is bounded (64 bits: 48 for time, 16 for logical)
```

### Tradeoffs

- **NTP only** is sufficient for most apps until clock skew
  causes actual bugs (stale caches, wrong TTLs, authentication
  token failures).
- **Lamport clocks** give you ordering but not conflict detection.
  Use for simple message ordering where you don't need to detect
  concurrent updates.
- **Vector clocks** give you full causality tracking but grow
  with cluster size. Prune nodes that haven't been heard from
  in a while.
- **HLC** is the pragmatic default for modern distributed systems
  (used by CockroachDB, YugabyteDB). Bounded size, monotonic,
  and close to wall-clock.

### Common Failure Modes

- **Using system time for UUID generation**: UUIDv1 uses MAC + timestamp.
  Clock skew produces duplicate UUIDs. Use UUIDv4 or UUIDv7.
- **NTP stepping clock backwards**: A negative time jump can
  break lease expiry, cache TTLs, and auth tokens.
  Solution: use `ntpd -s` (slew mode) or chrony with `makestep`
  disabled.
- **TTLs based on wall clock across nodes**: If Node A issues a
  token expiring in 5 minutes, and Node B's clock is 5 minutes
  behind, the token lives 10 minutes on Node B.
- **Ignoring clock skew entirely**: Works until it doesn't, usually
  at 2AM during a production incident.

---

## 10. NETWORK PARTITIONS — Handling Split-Brain

### Problem Statement

Networks fail. A partition means some nodes can't communicate
with others. The system must detect the partition, prevent
split-brain (two nodes both acting as leader), and degrade
gracefully rather than crash entirely.

### Detection

```typescript
// Distributed failure detector with gossip
class PhiAccrualFailureDetector {
  private heartbeats: Map<string, number[]> = new Map();
  private readonly threshold = 8;  // φ threshold (lower = more sensitive)

  reportHeartbeat(nodeId: string): void {
    if (!this.heartbeats.has(nodeId)) {
      this.heartbeats.set(nodeId, []);
    }
    this.heartbeats.get(nodeId)!.push(Date.now());

    // Keep only last 1000 samples
    const hb = this.heartbeats.get(nodeId)!;
    if (hb.length > 1000) hb.shift();
  }

  // Compute suspicion level φ
  // φ = -log10(P(no heartbeat | expected arrival))
  // φ = 1 means 10% chance node is down
  // φ = 8 means 0.000001% chance (very suspicious)
  getPhi(nodeId: string): number {
    const hb = this.heartbeats.get(nodeId);
    if (!hb || hb.length < 10) return 0;

    // Calculate mean and variance of inter-arrival times
    const intervals: number[] = [];
    for (let i = 1; i < hb.length; i++) {
      intervals.push(hb[i] - hb[i - 1]);
    }

    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, x) => sum + (x - mean) ** 2, 0) / intervals.length;
    const stddev = Math.sqrt(variance);

    // Time since last heartbeat
    const timeSinceLast = Date.now() - hb[hb.length - 1];

    // φ = -log10(P(timeSinceLast | mean, stddev))
    // CDF of exponential distribution
    const phi = -Math.log10(Math.exp(-timeSinceLast / mean));

    return phi;
  }

  isAvailable(nodeId: string): boolean {
    return this.getPhi(nodeId) < this.threshold;
  }
}
```

### Split-Brain Prevention

#### Quorum-Based Decisions

```
Cluster of 5 nodes:
  Write quorum (W): 3  (must ack write)
  Read quorum (R):  3  (must respond to read)
  Total nodes (N):  5

  Formula: W + R > N  -> guarantees read-your-writes
  Formula: W > N/2    -> prevents split-brain writes

  If partition splits 3 and 2:
    - Majority side (3 nodes): can form quorum, serves requests
    - Minority side (2 nodes): cannot form quorum, rejects writes
    -> No split-brain!
```

```typescript
// Quorum-based operation
class QuorumStore {
  private nodes: NodeClient[];

  async quorumWrite(key: string, value: unknown): Promise<number> {
    const W = Math.floor(this.nodes.length / 2) + 1;  // Majority

    const results = await Promise.allSettled(
      this.nodes.map((node) => node.write(key, value))
    );

    const successes = results.filter((r) => r.status === 'fulfilled').length;

    if (successes >= W) {
      return successes;  // Write succeeded with quorum
    }

    throw new Error(`Write failed: ${successes}/${W} acks`);
  }

  async quorumRead(key: string): Promise<{ value: unknown; version: number }> {
    const R = Math.floor(this.nodes.length / 2) + 1;

    const results = await Promise.allSettled(
      this.nodes.map((node) => node.read(key))
    );

    const values: { value: unknown; version: number }[] = [];

    for (const r of results) {
      if (r.status === 'fulfilled') {
        values.push(r.value);
      }
    }

    if (values.length >= R) {
      // Return the value with highest version (or use vector clock)
      values.sort((a, b) => b.version - a.version);
      return values[0];
    }

    throw new Error(`Read failed: ${values.length}/${R} responses`);
  }
}
```

#### Graceful Degradation

```typescript
// Feature flags based on partition status
class DegradationManager {
  private partitionDetected = false;
  private mode: 'normal' | 'read-only' | 'degraded' = 'normal';

  onPartitionDetected(): void {
    this.partitionDetected = true;
    this.mode = 'read-only';
    alertOps("Network partition detected — switched to read-only");
  }

  onPartitionHealed(): void {
    this.partitionDetected = false;
    // Sync data from majority side
    this.syncData()
      .then(() => { this.mode = 'normal'; })
      .catch(() => { this.mode = 'degraded'; });
  }

  async handleRequest(req: Request): Promise<Response> {
    switch (this.mode) {
      case 'normal':
        return this.processNormal(req);

      case 'read-only':
        if (req.method !== 'GET') {
          return { status: 503, body: 'Read-only mode — try again later' };
        }
        return this.processNormal(req);

      case 'degraded':
        // Serve stale cache if available
        const cached = await this.serveFromCache(req);
        if (cached) return cached;
        return { status: 503, body: 'Service unavailable' };
    }
  }
}
```

### Tradeoffs

- **Quorum writes** (W > N/2) prevent split-brain but reduce
  availability. In a 5-node cluster, losing 2 nodes makes
  writes impossible.
- **Read-repair** heals inconsistencies but adds latency to reads.
- **Graceful degradation** is better than total outage but
  requires feature-flagging every critical path.

### Common Failure Modes

- **No partition detection at all**: The minority side keeps
  accepting writes, creating diverged state that's impossible
  to reconcile.
- **Quorum too small**: W = 1 means any node can accept writes.
  During a partition, all sides keep writing. Split-brain.
- **No recovery process**: After partition heals, you need to
  re-sync divergent data. If you don't have a merge strategy,
  data is permanently lost.
- **Ignoring the minority side**: The majority side survives,
  but the minority side's data is as important as the majority's.
  Have a plan for both.

---

## 11. CQRS — Command Query Responsibility Segregation

### Problem Statement

Using the same model for reads and writes creates complexity:
write models are optimized for consistency, read models for
query performance. CQRS separates them so each can be optimized
independently.

### Architecture

```
+------------------+     +------------------+
|   Command Side   |     |    Query Side    |
|  (Write Model)   |     |   (Read Model)   |
+------------------+     +------------------+
| - Commands:      |     | - Queries:       |
|   CreateOrder    |     |   GetOrderById   |
|   UpdateOrder    |     |   ListOrders     |
|   CancelOrder    |     |   SearchOrders   |
+--------+---------+     +--------+---------+
         |                        |
         |  (write)               |  (read)
         v                        v
+------------------+     +------------------+
|  Write Database  |     |  Read Database   |
|  (Normalized)    |     |  (Denormalized)  |
|  - events or     |     |  - materialized  |
|    current state |     |    views         |
+--------+---------+     +--------+---------+
         |                        ^
         |     Event Bus          |
         +-------sync------------>+
```

### When to Use CQRS

| Scenario | Use CQRS? | Alternative |
|----------|-----------|-------------|
| Simple CRUD | No | Just use normalized DB |
| Different read/write throughput (reads >> writes) | Yes | Read replicas |
| Complex queries on write-optimized data | Yes | Views or materialized views |
| Event sourcing | Almost always | CQRS is natural with event sourcing |
| Team splits read/write ownership | Yes | Separate bounded contexts |
| < 50K users | Probably not | Keep it simple |

### CQRS Implementation

```typescript
// Command (write) model
class CreateOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly items: OrderItem[],
    public readonly shippingAddress: Address
  ) {}
}

class OrderCommandHandler {
  constructor(
    private readonly eventStore: EventStore,
    private readonly eventBus: EventBus
  ) {}

  async handle(command: CreateOrderCommand): Promise<void> {
    const order = new Order(command.orderId, command.customerId);

    for (const item of command.items) {
      order.addItem(item);
    }

    order.setShippingAddress(command.shippingAddress);

    // Command handler only validates and persists
    // It does NOT return data for queries
    await this.eventStore.save(order);
    await this.eventBus.publish(new OrderCreatedEvent(command.orderId));
  }
}

// Query (read) model — completely separate
class OrderReadModel {
  constructor(
    private readonly readDB: Database
  ) {
    // Initialize projections
    this.readDB.run(`
      CREATE TABLE IF NOT EXISTS order_summaries (
        order_id TEXT PRIMARY KEY,
        customer_id TEXT,
        customer_name TEXT,
        total DECIMAL,
        status TEXT,
        item_count INTEGER,
        created_at TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);
  }

  async getOrder(id: string): Promise<OrderDTO> {
    // Optimized for display, not normalized
    return this.readDB.get(
      `SELECT * FROM order_summaries WHERE order_id = ?`,
      [id]
    );
  }

  async listOrders(customerId: string, limit = 20, offset = 0): Promise<OrderDTO[]> {
    // Denormalized, indexed, fast
    return this.readDB.all(
      `SELECT * FROM order_summaries
       WHERE customer_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [customerId, limit, offset]
    );
  }
}

// Projection: subscribes to events and updates read model
class OrderProjection {
  constructor(private readonly readModel: OrderReadModel) {}

  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    await this.readModel.upsertOrder(event.data);
  }

  async onOrderShipped(event: OrderShippedEvent): Promise<void> {
    await this.readModel.updateStatus(event.data.orderId, 'shipped');
  }
}
```

### Event-Sourced CQRS

```
Command: CreateOrder { items: [...], total: 99.99 }
    |
    v
Event Store ---> OrderCreated { id: "123", items: [...], total: 99.99 }
    |
    v
Read Model 1: order_summaries (for order list page)
    |
    v
Read Model 2: customer_orders (for customer dashboard)
    |
    v
Read Model 3: inventory_impact (for inventory team)
    |
    v
Read Model 4: analytics_events (for product analytics)
```

```typescript
// Each read model is a SEPARATE projection
// They can be rebuilt independently

class RebuildManager {
  async rebuildReadModel(modelName: string): Promise<void> {
    // 1. Drop current read model
    await this.dropModel(modelName);

    // 2. Replay ALL events from beginning
    const events = this.eventStore.getAllEvents();
    const projection = this.projections[modelName];

    for await (const batch of events) {
      for (const event of batch) {
        await projection.handle(event);
      }
    }

    // 3. Model is now consistent
    console.log(`Rebuilt ${modelName} from ${events.length} events`);
  }
}
```

### Tradeoffs

- **CQRS without event sourcing** is just separate read/write
  models. This is a good middle ground — you get the benefits
  without the full complexity of event sourcing.
- **CQRS + event sourcing** gives you complete audit trail and
  rebuild capability, but every read model needs a projection.
- **Eventual consistency between models**: Write succeeds but
  read model is stale for milliseconds to seconds.
- **Operational complexity**: Two (or more) databases to manage,
  projections to monitor, schema migrations on both sides.

### Common Failure Modes

- **CQRS for simple CRUD**: If your queries are basic CRUD
  (get by ID, list by user), CQRS adds complexity with zero
  benefit. Just use a normalized database.
- **Projection failures**: If a projection crashes, the read
  model goes stale. Monitor projection lag with alerts.
- **Joins across read/write models**: If you need data from
  both in one request, your read model is wrong. Denormalize
  everything the read side needs.
- **Command returns data**: A command should return `{ success: true }`,
  not the updated entity. If consumers need data after a command,
  they query the read model. This breaks if the read model is
  eventually consistent — you need `read-after-write` guarantees.

---

## ARCHITECTURE DECISION CHECKLIST

Before finalizing any distributed systems design, verify:

### Consistency & Ordering

- [ ] CAP tradeoffs explicitly chosen per data type (CP vs AP)
- [ ] Conflict resolution strategy defined (LWW, CRDT, custom merge)
- [ ] Clock skew accounted for (HLC or logical clocks, not wall clocks)
- [ ] Event ordering guarantees documented per stream

### Messaging & Events

- [ ] Message broker chosen based on throughput and retention needs
- [ ] Dead letter queues configured for all consumers
- [ ] Idempotency keys on all event handlers
- [ ] Outbox pattern used for reliable event publishing
- [ ] Schema versioning strategy documented and enforced
- [ ] Consumer lag monitoring implemented

### Transactions & Sagas

- [ ] Choreography vs orchestration chosen appropriately for N services
- [ ] Compensating transactions defined for every saga step
- [ ] Compensations are idempotent and handle retries
- [ ] Saga orchestrator state is persisted (not in-memory)
- [ ] 2PC only used within single service boundary (never across services)

### Consensus & Coordination

- [ ] Leader election uses consensus protocol (Raft, etcd, K8s Lease)
- [ ] Cluster size supports expected failure tolerance (N >= 3, odd)
- [ ] Quorum sizes satisfy W + R > N for strong consistency
- [ ] Split-brain prevention via quorum (W > N/2)
- [ ] Graceful degradation defined for partition scenarios

### CQRS & Event Sourcing

- [ ] CQRS justified by differing read/write patterns (not premature)
- [ ] Read models maintainable as independent projections
- [ ] Staleness windows documented and acceptable to consumers
- [ ] Rebuild capability verified (can replay events)
- [ ] Event schema registry in place

### Monitoring & Operations

- [ ] All async operations have visibility (queue depth, lag, errors)
- [ ] Compensating transaction failures trigger alerts
- [ ] Network partition detection configured with alerting
- [ ] Clock skew monitoring (NTP offset tracked in metrics)
- [ ] Retry with exponential backoff + jitter on all RPCs
- [ ] Circuit breakers configured around external dependencies

## RULES

- ALWAYS classify scale before selecting a distributed systems pattern
- ALWAYS document the CAP tradeoff for each data store
- ALWAYS define compensating transactions for saga steps
- ALWAYS make event handlers idempotent
- ALWAYS use the outbox pattern for reliable event publication
- ALWAYS monitor queue depth, consumer lag, and projection lag
- ALWAYS tune leader election timeouts to network latency (10x expected RTT)
- NEVER use 2PC across service boundaries
- NEVER depend on wall-clock timestamps for ordering across nodes
- NEVER skip conflict resolution for eventually consistent data
- NEVER use Redis Pub/Sub for messages that must survive restarts
- NEVER add CQRS for simple CRUD apps
- NEVER assume network partitions won't happen
- NEVER design a system where clock skew causes correctness bugs
