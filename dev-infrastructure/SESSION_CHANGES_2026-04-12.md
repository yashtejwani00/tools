# Session Change Log - 2026-04-12

## Scope
Single-developer setup for `dev1` on current machine, using pasted Udichi source folder under:
`instances/dev1/udichi`

## What was done in this session

### 1. Workspace preparation
- Confirmed folder placement for Udichi under `instances/dev1/`.
- User pasted folder as `udichi copy` and renamed it to `udichi`.

### 2. Compose wiring for full Udichi folder mode
- Updated `instances/dev1/docker-compose.yml` to run Udichi from full folder mount:
  - `./udichi:/opt/udichi`
- Removed old split mount approach (`war/`, `config/`, `logs/`, template start script bind).
- Kept `udichi` service on `eclipse-temurin:8-jdk-jammy` and port mapping `18888 -> 8888`.

### 3. Udichi startup script hardening
- Updated `instances/dev1/udichi/bin/start-udichi.sh`:
  - dynamic `BASE_DIR` from script location
  - startup dependency waits for Kafka, Zookeeper, MongoDB
  - safe handling of `JAVA_OPTS`
  - optional debug mode controlled by env vars
  - classpath protection: excluded `athena-jdbc-*` jars from runtime classpath
- Reason: fixed startup crash caused by Log4j class conflict (`NoSuchMethodError`).

### 4. Core runtime config updates (container network)
- Updated `instances/dev1/udichi/config/udichi.properties`:
  - `zk.connect=dev1-zookeeper:2181`
  - `kafka.bootstrap.servers=dev1-kafka:9092`
  - `mongodb.connect=mongodb://admin:dev_infra_local@shared-mongodb:27017/dev1?authSource=admin`
- Updated `instances/dev1/udichi/config/udc.properties` with same values.

### 5. ZineOne properties alignment
- Updated:
  - `instances/dev1/udichi/war/WEB-INF/classes/META-INF/zineone.properties`
  - `instances/dev1/udichi/war/WEB-INF/classes/META-INF/zineone.properties.local`
- Set for local docker setup:
  - `zkServer=shared-zookeeper`
  - `analytics.zkServer=shared-zookeeper`
  - `server.url=http://localhost:18888`

### 6. Script improvements in infra repo
- Updated `scripts/start-instance.sh`:
  - startup validation now supports either:
    - deployed WAR mode, or
    - full Udichi folder mode (`instances/<dev>/udichi/bin/start-udichi.sh`)
- Updated `scripts/status.sh`:
  - improved status detection via container state
  - can show `RUNNING`, `APP_RESTARTING`, `BROKER_ONLY`, `STOPPED`

### 7. Runtime issue triage and fixes
- Observed repeated Udichi restarts initially.
- Fixed classpath crash (`NoSuchMethodError` from Log4j) via startup script jar exclusion.
- Next blocker was HBase schema missing (`TableNotFoundException: profile`).
- Ran one-time installer in Java 8 container:
  - `instances/dev1/udichi/bin/z1install.sh`
  - Installer created required HBase tables and completed.

### 8. Stream Kafka bootstrap fix
- Observed stream producer still trying `localhost:9092` (`ConnectException`).
- Root cause: stream module defaults without explicit `stream.kafka.*` overrides.
- Updated `instances/dev1/docker-compose.yml` Udichi env:
  - `STREAM_KAFKA_BOOTSTRAP_SERVERS=dev1-kafka:9092`
- `STREAM_KAFKA_PRODUCER_BOOTSTRAP_SERVERS=dev1-kafka:9092`
- `STREAM_KAFKA_CONSUMER_BOOTSTRAP_SERVERS=dev1-kafka:9092`
- Verified logs now show stream producer bootstrap set to `dev1-kafka:9092`.

### 9. Installer script hardening
- Updated `instances/dev1/udichi/bin/hbase-installer.sh`:
  - robust Java detection (`JAVA_HOME` or `java` in PATH)
  - Linux-safe script behavior
  - host defaults for installer inputs
  - host-to-container auto delegation (`docker exec` into `dev1-udichi`)
- Updated `instances/dev1/udichi/bin/z1install.sh`:
  - robust Java detection (`JAVA_HOME` or `java` in PATH)
  - fixed zookeeper property parsing (no invalid `source` of dotted keys like `analytics.zkServer`)
  - host-to-container auto delegation (`docker exec` into `dev1-udichi`)
- Practical outcome:
  - Running installers from host now resolves through the running Udichi container and works in docker DNS context.
  - Docker-based Java 8 installer path also succeeded and completed.

### 10. Java runtime alignment on host
- Installed Java 8:
  - `openjdk-8-jdk`
- Switched system alternatives to Java 8:
  - `java` and `javac` now point to `1.8.0_482` in manual mode.

### 11. Log verbosity tuning
- Updated:
  - `instances/dev1/udichi/config/udichi.properties` -> `log.debug=false`
  - `instances/dev1/udichi/config/udc.properties` -> `log.debug=false`
- Added `instances/dev1/udichi/war/WEB-INF/classes/log4j.properties` override:
  - `log4j.rootLogger=INFO`
  - `log4j.logger.org.apache.kafka=WARN`
  - `log4j.logger.org.apache.zookeeper=WARN`
- Restarted `dev1-udichi` and verified service remained healthy after log-level changes.

### 12. `z1shell.sh` and `z1ops.sh` stabilization
- Reworked `instances/dev1/udichi/bin/z1shell.sh`:
  - replaced fragile `source <(grep ...)` parsing
  - corrected Java selection logic
  - added host-to-container auto delegation (`dev1-udichi`)
  - excluded `athena-jdbc-*` jars from classpath
  - passed full Mongo endpoint (without `mongodb://`) including auth/db
- Reworked `instances/dev1/udichi/bin/z1ops.sh` similarly:
  - removed hardcoded `localhost localhost:2182`
  - fixed bash arg handling (`debug` mode safe when no arg)
  - added host-to-container auto delegation
  - excluded `athena-jdbc-*` jars from classpath

### 13. ZooKeeper endpoint alignment for admin/ops tools
- Updated both `z1shell.sh` and `z1ops.sh` to prefer:
  - `zk.connect` from `instances/dev1/udichi/config/udichi.properties`
- Result:
  - tools now default to `dev1-zookeeper:2181` (runtime coordination path) instead of stale shared ZK assumptions.
  - override env vars still supported:
    - `ADMINTOOLS_ZK_ENDPOINT`, `ADMINTOOLS_MONGO_ENDPOINT`
    - `OPSTOOL_ZK_ENDPOINT`, `OPSTOOL_MONGO_ENDPOINT`

## Validation performed
- Checked container health/status repeatedly:
  - shared services healthy
  - `dev1-zookeeper`, `dev1-kafka`, `dev1-udichi` healthy
- Verified `dev1-udichi` restart count reached `0` after final recreate.
- Checked endpoint:
  - `http://localhost:18888/` responds with `403` JSON (expected unauthenticated root behavior).
- Re-ran installer in Java 8 Docker context and confirmed `Installation completed.`

## Current known state (end of session)
- `dev1` stack is up and stable.
- Primary setup path is now full-folder Udichi mode (not template script mode).
- No active startup crash for prior issues (`NoSuchMethodError`, `TableNotFoundException`, stream `localhost:9092` misroute).
- Host default Java is Java 8.

## Quick restart steps for tomorrow
```bash
cd /home/yash/git/personal/tools/dev-infrastructure

docker compose -f shared/docker-compose.shared.yml up -d
./scripts/start-instance.sh dev1
./scripts/status.sh dev1
```

If a fresh environment ever shows missing HBase tables again:
```bash
cd /home/yash/git/personal/tools/dev-infrastructure/instances/dev1/udichi/bin
./z1install.sh
```
