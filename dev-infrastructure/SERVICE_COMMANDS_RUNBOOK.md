# Service Commands Runbook

All commands below assume you are in:
`/home/yash/git/personal/tools/dev-infrastructure`

## 1. One-time setup (new machine)
```bash
./scripts/setup.sh
```

If needed (manual shared network create):
```bash
docker network create dev-shared-network
```

### Java prerequisite (recommended)
```bash
# check current default java
java -version
javac -version

# install Java 8 (if needed)
sudo apt-get update
sudo apt-get install -y openjdk-8-jdk

# set Java 8 as system default
sudo update-java-alternatives -s java-1.8.0-openjdk-amd64
```

## 2. Start everything (recommended)
```bash
# shared services (MongoDB + shared ZooKeeper + HBase)
docker compose -f shared/docker-compose.shared.yml up -d

# dev1 services (dev1 ZooKeeper + Kafka + Udichi)
./scripts/start-instance.sh dev1
```

## 3. Stop everything
```bash
# stop dev1 stack
./scripts/stop-instance.sh dev1

# stop shared stack
docker compose -f shared/docker-compose.shared.yml down
```

## 4. Shared services commands

### MongoDB (shared)
```bash
# start
docker compose -f shared/docker-compose.shared.yml up -d mongodb

# stop
docker compose -f shared/docker-compose.shared.yml stop mongodb

# restart
docker compose -f shared/docker-compose.shared.yml restart mongodb

# logs
docker compose -f shared/docker-compose.shared.yml logs -f mongodb
```

### Shared ZooKeeper
```bash
# start
docker compose -f shared/docker-compose.shared.yml up -d zookeeper

# stop
docker compose -f shared/docker-compose.shared.yml stop zookeeper

# restart
docker compose -f shared/docker-compose.shared.yml restart zookeeper

# logs
docker compose -f shared/docker-compose.shared.yml logs -f zookeeper
```

### HBase (shared)
```bash
# start
docker compose -f shared/docker-compose.shared.yml up -d hbase

# stop
docker compose -f shared/docker-compose.shared.yml stop hbase

# restart
docker compose -f shared/docker-compose.shared.yml restart hbase

# logs
docker compose -f shared/docker-compose.shared.yml logs -f hbase
```

## 5. Dev1 services commands

Note: dev1 has its own ZooKeeper and Kafka, plus Udichi app.

### Start all dev1 services
```bash
./scripts/start-instance.sh dev1
```

### Stop all dev1 services
```bash
./scripts/stop-instance.sh dev1
```

### Restart all dev1 services
```bash
./scripts/restart-instance.sh dev1
```

### Start/stop individual dev1 services
```bash
# start only dev1 ZooKeeper
docker compose -f instances/dev1/docker-compose.yml --env-file instances/dev1/.env up -d zookeeper

# stop only dev1 ZooKeeper
docker compose -f instances/dev1/docker-compose.yml --env-file instances/dev1/.env stop zookeeper

# start only dev1 Kafka
docker compose -f instances/dev1/docker-compose.yml --env-file instances/dev1/.env up -d kafka

# stop only dev1 Kafka
docker compose -f instances/dev1/docker-compose.yml --env-file instances/dev1/.env stop kafka

# start only Udichi
docker compose -f instances/dev1/docker-compose.yml --env-file instances/dev1/.env up -d udichi

# stop only Udichi
docker compose -f instances/dev1/docker-compose.yml --env-file instances/dev1/.env stop udichi

# restart only Udichi
docker compose -f instances/dev1/docker-compose.yml --env-file instances/dev1/.env restart udichi
```

### Logs (dev1)
```bash
# all dev1 services
./scripts/logs.sh dev1 -f

# only Udichi logs
./scripts/logs.sh dev1 udichi -f

# only Kafka logs
./scripts/logs.sh dev1 kafka -f

# only ZooKeeper logs
./scripts/logs.sh dev1 zookeeper -f
```

### Logs (last N lines)
```bash
# last 100 udichi log lines
docker logs --tail 100 dev1-udichi

# last 1000 udichi log lines
docker logs --tail 1000 dev1-udichi

# last 200 lines and follow
docker logs --tail 200 -f dev1-udichi

# last 1000 lines, only errors
docker logs --tail 1000 dev1-udichi 2>&1 | rg "ERROR|FATAL|Exception|Failed"
```

## 6. Health/status checks
```bash
# infra status summary
./scripts/status.sh

# dev1 compose status
docker compose -f instances/dev1/docker-compose.yml --env-file instances/dev1/.env ps

# shared compose status
docker compose -f shared/docker-compose.shared.yml ps

# udichi endpoint check
curl -i http://localhost:18888/
```

## 7. Useful URLs
- Udichi (dev1): `http://localhost:18888`
- Shared MongoDB: `localhost:27017`
- Shared ZooKeeper: `localhost:2180`
- HBase UI: `http://localhost:16030`

## 8. Udichi helper scripts (admin/ops/install)
Run from:
`/home/yash/git/personal/tools/dev-infrastructure/instances/dev1/udichi/bin`

```bash
# Admin shell
./z1shell.sh

# Ops shell
./z1ops.sh

# Install/repair core tables
./z1install.sh

# HBase installer path
./hbase-installer.sh
```

Notes:
- These scripts now auto-run inside `dev1-udichi` when invoked from host.
- `z1shell.sh` and `z1ops.sh` use `zk.connect` from `config/udichi.properties` by default.
- Classpath excludes `athena-jdbc-*` to avoid Log4j runtime method conflicts.

Force endpoint overrides (if needed):
```bash
ADMINTOOLS_ZK_ENDPOINT=dev1-zookeeper:2181 ./z1shell.sh
OPSTOOL_ZK_ENDPOINT=dev1-zookeeper:2181 ./z1ops.sh
ADMINTOOLS_MONGO_ENDPOINT='admin:dev_infra_local@shared-mongodb:27017/dev1?authSource=admin' ./z1shell.sh
OPSTOOL_MONGO_ENDPOINT='admin:dev_infra_local@shared-mongodb:27017/dev1?authSource=admin' ./z1ops.sh
```

If Udichi logs show `TableNotFoundException`, run:
```bash
./z1install.sh
docker compose -f /home/yash/git/personal/tools/dev-infrastructure/instances/dev1/docker-compose.yml \
  --env-file /home/yash/git/personal/tools/dev-infrastructure/instances/dev1/.env restart udichi
```
