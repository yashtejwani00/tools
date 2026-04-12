# Udichi Knowledge Base (High-Level)

## Purpose
This document captures practical Udichi knowledge learned during this setup session for `dev1`.
It is written for fast onboarding and operational clarity.

## Scope
- Environment: local Docker-based infra in this repo.
- Target app: Udichi running in `instances/dev1/udichi`.
- Focus: architecture, configuration model, startup behavior, dependencies, troubleshooting, and operational commands.

## 1) System Topology

Udichi runs as part of a split architecture:
- Shared stateful dependencies (MongoDB, shared ZooKeeper, HBase).
- Per-developer app stack (dev1 ZooKeeper, dev1 Kafka, dev1 Udichi process).

```text
                          +------------------------------+
                          | Host Machine                 |
                          | localhost ports              |
                          | 18888 Udichi                 |
                          | 9092/9093 Kafka (dev1)       |
                          | 2181 ZK (dev1)               |
                          | 27017 MongoDB (shared)       |
                          | 2180 ZK (shared)             |
                          | 16030 HBase UI               |
                          +---------------+--------------+
                                          |
                             docker networks bridge
                                          |
        +---------------------------------+--------------------------------+
        |                                                                  |
+-------v------------------+                               +---------------v----------------+
| dev1 stack               |                               | shared stack                    |
|                          |                               |                                |
| dev1-zookeeper:2181      |                               | shared-zookeeper:2181          |
| dev1-kafka:9092          |                               | shared-mongodb:27017           |
| dev1-udichi:8888         |------------------------------>| shared-hbase:*                 |
| (Java app)               |  uses Mongo/ZK/HBase         |                                |
+--------------------------+                               +--------------------------------+
```

## 2) Runtime Model

### Container composition
`instances/dev1/docker-compose.yml` defines 3 services:
- `zookeeper` (`dev1-zookeeper`)
- `kafka` (`dev1-kafka`)
- `udichi` (`dev1-udichi`)

Udichi is mounted in full-folder mode:
- `./udichi:/opt/udichi`

This means config/scripts/jars are read directly from your local `instances/dev1/udichi` folder.

### Udichi startup entrypoint
Udichi starts via:
- `/opt/udichi/bin/start-udichi.sh`

High-level behavior of startup script:
- Builds classpath from app folders.
- Skips `athena-jdbc-*` in `war/WEB-INF/lib` to avoid log4j class conflicts.
- Waits for TCP reachability:
  - `dev1-kafka:9092`
  - `dev1-zookeeper:2181`
  - `shared-mongodb:27017`
- Launches `com.udc.Main` with configured JVM options.

```text
start-instance.sh
  -> docker compose up (dev1)
     -> udichi container command: /opt/udichi/bin/start-udichi.sh
        -> wait for Kafka/ZK/Mongo
        -> build classpath
        -> java ... com.udc.Main
           -> initialize services/consumers
           -> bind web server on 8888
```

## 3) Configuration Surfaces

Udichi behavior is controlled from multiple places.

### A) Docker Compose environment (`instances/dev1/docker-compose.yml`)
Key variables:
- `KAFKA_BOOTSTRAP_SERVERS=dev1-kafka:9092`
- `STREAM_KAFKA_BOOTSTRAP_SERVERS=dev1-kafka:9092`
- `STREAM_KAFKA_PRODUCER_BOOTSTRAP_SERVERS=dev1-kafka:9092`
- `STREAM_KAFKA_CONSUMER_BOOTSTRAP_SERVERS=dev1-kafka:9092`
- `ZOOKEEPER_CONNECT=dev1-zookeeper:2181`
- `MONGODB_URI=...shared-mongodb...`
- `HBASE_ZOOKEEPER_QUORUM=shared-zookeeper`

Important lesson:
Without explicit `STREAM_KAFKA_*` overrides, one internal stream producer used `localhost:9092` and generated connection errors.

### B) Udichi core properties
Files:
- `instances/dev1/udichi/config/udichi.properties`
- `instances/dev1/udichi/config/udc.properties`

Observed important keys:
- `zk.connect=dev1-zookeeper:2181`
- `kafka.bootstrap.servers=dev1-kafka:9092`
- `mongodb.connect=mongodb://...@shared-mongodb:27017/dev1?...`
- `web.port=8888`
- `singleton.server=true` (in `udichi.properties`)
- `log.debug=false`

### C) ZineOne properties
Files:
- `war/WEB-INF/classes/META-INF/zineone.properties`
- `war/WEB-INF/classes/META-INF/zineone.properties.local`

Key values aligned for this setup:
- `zkServer=shared-zookeeper`
- `zkPort=2181`
- `analytics.zkServer=shared-zookeeper`
- `server.url=http://localhost:18888`

These are significant for installer/bootstrap logic and internal integrations.

### D) Tool script endpoint source (important)
For operational scripts:
- `bin/z1shell.sh`
- `bin/z1ops.sh`

Current behavior:
- Prefer `zk.connect` from `config/udichi.properties` for namespace/runtime coordination (`dev1-zookeeper:2181`).
- Mongo endpoint comes from `config/udichi.properties` (`mongodb.connect`) and is passed with auth/db context.
- If invoked from host, scripts auto-run inside `dev1-udichi` (container DNS context).

## 4) Data and Dependency Responsibilities

- MongoDB: account/system/state documents.
- Kafka (dev1): internal event and worker topics (many consumer groups).
- ZooKeeper (dev1): Kafka coordination and app coordination points.
- ZooKeeper (shared): HBase coordination and related app references.
- HBase (shared): core tables used by Udichi processing.

High-level data flow:

```text
HTTP -> Udichi API/Services
          |
          +--> MongoDB reads/writes
          +--> Kafka producer/consumer workflows
          +--> HBase table operations
                   |
                   +--> shared-zookeeper metadata/coordination
```

## 5) Installation and Bootstrap (HBase Tables)

Udichi requires HBase tables to exist (example failure seen: `TableNotFoundException: profile`).

### Preferred bootstrap path
Run installer directly from host (it auto-delegates into `dev1-udichi`):

```bash
cd /home/yash/git/personal/tools/dev-infrastructure/instances/dev1/udichi/bin
./z1install.sh
```

Why this path is preferred:
- Correct Java version/environment from running Udichi container.
- Correct Docker DNS visibility automatically.
- Avoids host runtime mismatches.

### Installer scripts and behavior
- `bin/z1install.sh`: now robust Java detection and safe zookeeper property parsing.
- `bin/hbase-installer.sh`: now robust Java detection, host defaults (`localhost:2180`) for shared ZK.
- Both scripts auto-delegate to running Udichi container when launched from host.

Practical note:
If the Udichi container is down, start `dev1` first, then run installers.

## 6) Java Compatibility Lessons

Observed compatibility behavior:
- Java 17 caused installer failures due to reflective/module access constraints (`InaccessibleObjectException`).
- Java 8 is required/recommended for legacy installer flows.

Current operational assumption:
- System default Java switched to Java 8 (`1.8.0_482`) for compatibility.

## 7) Logging Behavior

### What was observed
- Very high Kafka `DEBUG` chatter is normal when verbose logging is enabled.
- These logs often show polling loops and metadata refreshes, not failures.

### What was changed
- `log.debug=false` in both config property files.
- Added `war/WEB-INF/classes/log4j.properties` override:
  - `log4j.rootLogger=INFO`
  - `org.apache.kafka=WARN`
  - `org.apache.zookeeper=WARN`

### How to interpret quickly
- Usually benign: `DEBUG ... Fetcher/NetworkClient ... recordsSizeInBytes=0`
- Treat as error signals:
  - `ERROR`
  - `FATAL`
  - `Exception`
  - `Failed to start`

## 8) Known Failure Modes and Fixes

### A) `NoSuchMethodError` around Log4j utility classes
Cause:
- Classpath conflict from bundled JDBC/logging classes.
Fix:
- Exclude `athena-jdbc-*` jar from startup classpath in `start-udichi.sh`.

### B) `TableNotFoundException: profile`
Cause:
- HBase schema not initialized.
Fix:
- Run installer (`z1install.sh`) from `instances/dev1/udichi/bin` (auto-delegates into `dev1-udichi`).

### C) Kafka connection attempts to `localhost:9092`
Cause:
- Stream module defaults not overridden.
Fix:
- Set `STREAM_KAFKA_*_BOOTSTRAP_SERVERS=dev1-kafka:9092` in compose.

### D) Host installer hangs/fails with `UnknownHostException: shared-zookeeper`
Cause:
- Host DNS cannot resolve internal Docker service name.
Fix:
- Use updated host-run helper scripts (`z1install.sh`/`hbase-installer.sh`) which auto-delegate into container.

### E) Installer fails with `InaccessibleObjectException`
Cause:
- Running installer on Java 17.
Fix:
- Use Java 8.

### F) `!!!! CRITICAL ERROR: No distributed trigger found to invalidate cache for <namespace>`
Cause:
- Namespace-level distributed cache trigger node does not exist in the ZooKeeper being used by admin/ops tool.
- Common when namespace data/bootstrap is incomplete or when tooling points to a different ZK than runtime.
Fix:
1. Ensure tools use runtime ZK (`dev1-zookeeper:2181`) via `zk.connect` default (already aligned in current scripts).
2. Ensure namespace/account bootstrap exists in Mongo for the target namespace.
3. Re-run admin/ops action after namespace setup.

## 9) Operational Commands (Most Useful)

### Start/stop/status
```bash
cd /home/yash/git/personal/tools/dev-infrastructure

docker compose -f shared/docker-compose.shared.yml up -d
./scripts/start-instance.sh dev1
./scripts/status.sh

./scripts/stop-instance.sh dev1
docker compose -f shared/docker-compose.shared.yml down
```

### Logs
```bash
# follow udichi logs
./scripts/logs.sh dev1 udichi -f

# tail last 100/1000 lines
docker logs --tail 100 dev1-udichi
docker logs --tail 1000 dev1-udichi

# tail + follow
docker logs --tail 200 -f dev1-udichi

# error-focused view
docker logs --tail 1000 dev1-udichi 2>&1 | rg "ERROR|FATAL|Exception|Failed"
```

### Restart only Udichi
```bash
docker compose -f instances/dev1/docker-compose.yml --env-file instances/dev1/.env restart udichi
```

## 10) Quick Mental Model

```text
If Udichi is unhealthy:
  1) Check container health/status
  2) Check logs for ERROR/FATAL/Exception
  3) Validate Kafka/ZK/Mongo reachability
  4) Validate stream bootstrap endpoints (not localhost)
  5) Validate HBase tables installed
  6) Re-run `z1install.sh` if schema-related
```

## 11) Session-Based Inference Notes
- Internal business modules are broad (ML scoring/training, monitoring, session compute, etc.) based on active Kafka consumer group names seen in logs.
- Runtime is event-heavy and continuously polling Kafka topics; low/no records is still healthy behavior.
- Multiple logging libraries are packaged; explicit overrides are useful for stable developer experience.
