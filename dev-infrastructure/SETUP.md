# Dev Infrastructure Setup Guide

Multi-instance development environment on Ubuntu server using Docker Compose.

## Current Scope

This infra is intentionally limited to **3 developer instances** (`dev1..dev3`).
After these are stable, scale-out can be done by adding new instance folders and port mappings.

## Pinned Runtime Versions

These are intentionally aligned with local runtime lineage and approved pullable tags:

- Java: `eclipse-temurin:8-jdk-jammy`
- Kafka: `wurstmeister/kafka:2.11-0.10.2.2` (matches local `0.10.x` line from `udichi/ext/kafka/libs`)
- ZooKeeper: `wurstmeister/zookeeper:3.4.6`
- MongoDB: `mongo:5.0`
- HBase: `flokkr/hbase:2.3.3`

## Architecture

- Per instance (`dev1..dev3`): `udichi + kafka + zookeeper`
- Shared services: `mongodb + zookeeper + hbase`

## Port Allocation

| Instance | udichi | Kafka | Zookeeper |
|----------|--------|-------|-----------|
| dev1     | 8888   | 9092  | 2181      |
| dev2     | 8988   | 9192  | 2281      |
| dev3     | 9088   | 9292  | 2381      |

Shared services:

- MongoDB: `27017`
- Shared ZooKeeper: `2180` (host mapped to container `2181`)
- HBase Master UI: `16010`
- HBase RegionServer UI: `16030`

## Initial Setup (Run Once)

```bash
cd ./dev-infrastructure
chmod +x scripts/*.sh
./scripts/setup.sh
```

This will:

- Install Docker/Docker Compose if needed
- Prepare `dev1..dev3` directories and compose files
- Start shared services
- Create shared Docker network

## Daily Operations

### Check status

```bash
./scripts/status.sh
```

### Deploy and start

```bash
./scripts/deploy.sh dev1 /path/to/build/war --restart
```

### Start/Stop/Restart

```bash
./scripts/start-instance.sh dev1
./scripts/stop-instance.sh dev1
./scripts/restart-instance.sh dev1
```

### Logs

```bash
./scripts/logs.sh dev1
./scripts/logs.sh dev1 -f
./scripts/logs.sh dev1 kafka
./scripts/logs.sh dev1 zookeeper
./scripts/logs.sh dev1 udichi
```

## Troubleshooting

### Container status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Shared service logs

```bash
docker logs shared-mongodb
docker logs shared-zookeeper
docker logs shared-hbase
```

### MongoDB connectivity

```bash
docker exec -it shared-mongodb mongosh -u admin -p ${MONGO_ROOT_PASSWORD:-CHANGE_ME} --authenticationDatabase admin
```
