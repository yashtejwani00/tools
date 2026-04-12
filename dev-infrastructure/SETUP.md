# Dev Infrastructure Setup Guide

Multi-instance development environment on Ubuntu 64GB server using Docker Compose.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Ubuntu 64GB Server                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐      ┌─────────────┐         │
│  │ Instance 1  │  │ Instance 2  │  ... │ Instance 10 │         │
│  │ (dev1)      │  │ (dev2)      │      │ (dev10)     │         │
│  │ ─────────── │  │ ─────────── │      │ ─────────── │         │
│  │ udichi:8888 │  │ udichi:8988 │      │ udichi:9788 │         │
│  │ kafka:9092  │  │ kafka:9192  │      │ kafka:9992  │         │
│  │ zk:2181     │  │ zk:2281     │      │ zk:3081     │         │
│  └─────────────┘  └─────────────┘      └─────────────┘         │
│        │                │                   │                   │
│        └────────────────┼───────────────────┘                   │
│                         │                                       │
│              ┌──────────┴──────────┐                           │
│              │   Shared Services    │                           │
│              │  ┌─────┐  ┌─────┐   │                           │
│              │  │Mongo│  │HBase│   │                           │
│              │  │27017│  │2180 │   │                           │
│              │  └─────┘  └─────┘   │                           │
│              └──────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
```

## Port Allocation

| Instance | udichi | Kafka | Zookeeper |
|----------|--------|-------|-----------|
| dev1     | 8888   | 9092  | 2181      |
| dev2     | 8988   | 9192  | 2281      |
| dev3     | 9088   | 9292  | 2381      |
| dev4     | 9188   | 9392  | 2481      |
| dev5     | 9288   | 9492  | 2581      |
| dev6     | 9388   | 9592  | 2681      |
| dev7     | 9488   | 9692  | 2781      |
| dev8     | 9588   | 9792  | 2881      |
| dev9     | 9688   | 9892  | 2981      |
| dev10    | 9788   | 9992  | 3081      |

## Initial Setup (Run Once)

### 1. Copy Infrastructure Files to Server

```bash
# On your local machine, copy to server
scp -r /tmp/dev-infrastructure ubuntu@your-server:/opt/

# SSH into server
ssh ubuntu@your-server
cd /opt/dev-infrastructure
```

### 2. Run Setup Script

```bash
cd /opt/dev-infrastructure
chmod +x scripts/*.sh
./scripts/setup.sh
```

This will:
- Install Docker & Docker Compose (if needed)
- Create all directories
- Start shared services (MongoDB + HBase)
- Create Docker networks

### 3. Configure Your Application

Before starting instances, you need to:

1. **Copy your start script** to each instance:
   ```bash
   cp /Users/yashwant/udichi/bin/start-udichi.sh instances/dev1/scripts/
   # ... repeat for all instances
   ```

2. **Copy your config files** to each instance:
   ```bash
   cp -r /Users/yashwant/udichi/config/* instances/dev1/config/
   # ... modify ports in config to match .env file
   ```

3. **Update config files** to use environment variables or correct ports for each instance.

## Daily Operations

### Check Status
```bash
./scripts/status.sh
```

### Deploy & Start an Instance

```bash
# Deploy WAR files and restart
./scripts/deploy.sh dev1 /path/to/build/war --restart

# Or deploy without restart
./scripts/deploy.sh dev1 /path/to/build/war
```

### Start/Stop/Restart
```bash
./scripts/start-instance.sh dev1
./scripts/stop-instance.sh dev1
./scripts/restart-instance.sh dev1
```

### View Logs
```bash
# All logs
./scripts/logs.sh dev1

# Follow logs
./scripts/logs.sh dev1 -f

# Specific service
./scripts/logs.sh dev1 udichi
./scripts/logs.sh dev1 kafka
./scripts/logs.sh dev1 zookeeper
```

## Developer Workflow

### For Developer Assigned to dev1:

1. **Build locally on your Mac**:
   ```bash
   cd /Users/yashwant/udichi
   # build commands...
   ```

2. **Deploy to your instance**:
   ```bash
   # On Ubuntu server
   cd /opt/dev-infrastructure
   ./scripts/deploy.sh dev1 /Users/yashwant/udichi/war --restart
   ```

   Or from your Mac:
   ```bash
   scp /Users/yashwant/udichi/war/*.jar ubuntu@server:/opt/dev-infrastructure/instances/dev1/war/
   ssh ubuntu@server "cd /opt/dev-infrastructure && ./scripts/restart-instance.sh dev1"
   ```

3. **Access your instance**:
   - Udichi: http://dev1.nexus.company.com (via Cloudflare tunnel)
   - Udichi API paths: http://dev1.nexus.company.com/api/
   - Or directly: http://server-ip:8888

## Cloudflare Tunnel Setup

1. **Install cloudflared** on Ubuntu server:
   ```bash
   wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

2. **Login and create tunnel**:
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create dev-infrastructure
   ```

3. **Create config** at `~/.cloudflared/config.yml`:
   ```yaml
   tunnel: <tunnel-id>
   credentials-file: /home/ubuntu/.cloudflared/<tunnel-id>.json
   
   ingress:
     - hostname: dev1.nexus.company.com
       service: http://localhost:8888
     - hostname: dev2.nexus.company.com
       service: http://localhost:8988
     # ... add all 10
     - service: http_status:404
   ```

4. **Run tunnel**:
   ```bash
   cloudflared tunnel route dns <tunnel-id> dev1.nexus.company.com
   # ... for each subdomain
   cloudflared tunnel run <tunnel-id>
   ```

## Troubleshooting

### Check container status:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Check logs:
```bash
docker logs shared-mongodb
docker logs shared-hbase
docker logs dev1-udichi
```

### Reset instance (clean slate):
```bash
cd instances/dev1
docker compose down -v  # Remove volumes too
rm -rf logs/* war/*
# Redeploy and restart
```

### MongoDB connection issues:
```bash
# Test connection
docker exec -it shared-mongodb mongosh -u admin -p ${MONGO_ROOT_PASSWORD:-CHANGE_ME} --authenticationDatabase admin
```

## Resource Usage

Estimated memory usage:
| Component | Per Instance | 10 Instances | Shared | Total |
|-----------|--------------|--------------|--------|-------|
| udichi    | ~1GB         | ~10GB        | -      | 10GB  |
| Kafka     | ~512MB       | ~5GB         | -      | 5GB   |
| Zookeeper | ~256MB       | ~2.5GB       | -      | 2.5GB |
| MongoDB   | -            | -            | ~4GB   | 4GB   |
| HBase     | -            | -            | ~8GB   | 8GB   |
| **Total** |              |              |        | **~30GB** |

Plenty of headroom on 64GB!
