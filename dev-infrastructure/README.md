# Dev Infrastructure

Docker-based local development infrastructure for Udichi.

## What This Repo Provides
- Shared platform services:
  - MongoDB (`shared-mongodb`)
  - ZooKeeper (`shared-zookeeper`)
  - HBase (`shared-hbase`)
- Per-developer stack (currently active/tested: `dev1`):
  - ZooKeeper (`dev1-zookeeper`)
  - Kafka (`dev1-kafka`)
  - Udichi app (`dev1-udichi`)

## Architecture (High-Level)

```text
+------------------------------ Host ------------------------------+
|                                                                  |
|  localhost:18888 -> dev1-udichi:8888                             |
|  localhost:9092/9093 -> dev1-kafka                               |
|  localhost:2181 -> dev1-zookeeper                                |
|                                                                  |
|  localhost:27017 -> shared-mongodb                               |
|  localhost:2180  -> shared-zookeeper                             |
|  localhost:16030 -> shared-hbase UI                              |
+-------------------------------+----------------------------------+
                                |
                        dev-shared-network
                                |
                +---------------+----------------+
                |                                |
         +------v-------+                 +------v------+
         | dev1 stack   |                 | shared stack|
         | (kafka/zk/app)|                |(mongo/zk/hbase)
         +--------------+                 +-------------+
```

## Prerequisites
- Ubuntu/Linux with Docker Engine + Docker Compose plugin.
- Recommended Java on host: Java 8 (needed for some legacy installer flows).

Check Docker:
```bash
docker --version
docker compose version
```

Check Java:
```bash
java -version
javac -version
```

Install/switch Java 8 if needed:
```bash
sudo apt-get update
sudo apt-get install -y openjdk-8-jdk
sudo update-java-alternatives -s java-1.8.0-openjdk-amd64
```

## One-Time Setup (New Machine)

From repo root:
```bash
cd /home/yash/git/personal/tools/dev-infrastructure
chmod +x scripts/*.sh
./scripts/setup.sh
```

This creates required folders, shared docker network, and starts shared services.

## Quick Start (Daily)

```bash
cd /home/yash/git/personal/tools/dev-infrastructure

# 1) Start shared dependencies
docker compose -f shared/docker-compose.shared.yml up -d

# 2) Start dev1 stack
./scripts/start-instance.sh dev1

# 3) Check overall status
./scripts/status.sh
```

Udichi endpoint:
- `http://localhost:18888`

## Stop / Restart

```bash
# stop dev1
./scripts/stop-instance.sh dev1

# restart dev1
./scripts/restart-instance.sh dev1

# stop shared stack
docker compose -f shared/docker-compose.shared.yml down
```

## Logs

### Script-based
```bash
# follow all dev1 service logs
./scripts/logs.sh dev1 -f

# follow only udichi
./scripts/logs.sh dev1 udichi -f
```

### Docker tail (recommended for recent output)
```bash
# last 100 lines
docker logs --tail 100 dev1-udichi

# last 1000 lines
docker logs --tail 1000 dev1-udichi

# tail + follow
docker logs --tail 200 -f dev1-udichi

# error-focused
docker logs --tail 1000 dev1-udichi 2>&1 | rg "ERROR|FATAL|Exception|Failed"
```

## Current dev1 Configuration Notes
- Udichi is mounted as full folder:
  - `instances/dev1/udichi -> /opt/udichi`
- Startup entrypoint:
  - `/opt/udichi/bin/start-udichi.sh`
- Core app config currently points to:
  - Kafka: `dev1-kafka:9092`
  - ZooKeeper: `dev1-zookeeper:2181`
  - MongoDB: `shared-mongodb:27017`
  - HBase ZooKeeper: `shared-zookeeper:2181`

## Udichi Helper Scripts (Admin/Ops/Install)

These scripts are safe to run from host under `instances/dev1/udichi/bin`:
- `z1shell.sh`
- `z1ops.sh`
- `z1install.sh`
- `hbase-installer.sh`

Behavior:
- When run from host, scripts auto-exec inside `dev1-udichi` container.
- `z1shell.sh` and `z1ops.sh` now prefer `zk.connect` from `config/udichi.properties` (dev1 runtime ZK: `dev1-zookeeper:2181`).
- Classpath excludes `athena-jdbc-*` to avoid Log4j `NoSuchMethodError`.

Common usage:
```bash
cd instances/dev1/udichi/bin
./z1shell.sh
./z1ops.sh
./z1install.sh
./hbase-installer.sh
```

Optional endpoint overrides:
```bash
ADMINTOOLS_ZK_ENDPOINT=dev1-zookeeper:2181 ./z1shell.sh
OPSTOOL_ZK_ENDPOINT=dev1-zookeeper:2181 ./z1ops.sh
```

## Common Recovery Step: HBase Table Initialization

If Udichi shows `TableNotFoundException` in logs, run installer:

```bash
cd instances/dev1/udichi/bin
./z1install.sh

# then restart udichi
docker compose -f instances/dev1/docker-compose.yml --env-file instances/dev1/.env restart udichi
```

## Repo Layout

```text
dev-infrastructure/
  instances/
    dev1/
      docker-compose.yml
      .env
      udichi/
  shared/
    docker-compose.shared.yml
  scripts/
    setup.sh
    start-instance.sh
    stop-instance.sh
    restart-instance.sh
    status.sh
    logs.sh
```

## Additional Docs
- Setup details: `SETUP.md`
- Commands runbook: `SERVICE_COMMANDS_RUNBOOK.md`
- Session changes: `SESSION_CHANGES_2026-04-12.md`
- Udichi technical knowledge: `UDICHI_KNOWLEDGE_BASE.md`
