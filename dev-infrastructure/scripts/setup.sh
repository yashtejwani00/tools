#!/bin/bash

# =============================================================================
# Dev Infrastructure Setup Script
# Run this on the Ubuntu 64GB server once to initialize everything
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo "======================================"
echo "  Dev Infrastructure Setup"
echo "======================================"
echo ""

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "❌ This script should NOT be run as root"
   echo "   Please run as a regular user with sudo privileges"
   exit 1
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. Please log out and back in for group changes to take effect."
    exit 0
else
    echo "✅ Docker already installed"
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose plugin not found"
    exit 1
else
    echo "✅ Docker Compose available"
fi

# Create directories
echo ""
echo "📁 Creating directory structure..."
mkdir -p "$INFRA_DIR/shared/data"
mkdir -p "$INFRA_DIR/nginx"

for i in {1..10}; do
    mkdir -p "$INFRA_DIR/instances/dev$i"/{war,config,logs,scripts}
done

echo "✅ Directories created"

# Copy docker-compose files to each instance
echo ""
echo "📋 Copying compose files to instances..."
for i in {1..10}; do
    cp "$INFRA_DIR/instances/docker-compose.template.yml" "$INFRA_DIR/instances/dev$i/docker-compose.yml"
done
rm "$INFRA_DIR/instances/docker-compose.template.yml"
echo "✅ Compose files copied"

# Create shared network
echo ""
echo "🌐 Creating shared Docker network..."
docker network create dev-shared-network 2>/dev/null || echo "✅ Shared network already exists"

# Start shared services
echo ""
echo "🚀 Starting shared services (MongoDB + HBase)..."
cd "$INFRA_DIR/shared"
docker compose up -d

echo ""
echo "⏳ Waiting for shared services to be healthy..."
sleep 10

# Check health
echo ""
echo "🔍 Checking service health..."
if docker ps | grep -q "shared-mongodb"; then
    echo "✅ MongoDB is running"
else
    echo "❌ MongoDB failed to start"
fi

if docker ps | grep -q "shared-hbase"; then
    echo "✅ HBase is running"
else
    echo "❌ HBase failed to start"
fi

echo ""
echo "======================================"
echo "  ✅ Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "  1. Copy your WAR/JAR files to instances/dev{N}/war/"
echo "  2. Copy your udichi config to instances/dev{N}/config/"
echo "  3. Copy your start script to instances/dev{N}/scripts/"
echo "  4. Start an instance: ./scripts/start-instance.sh dev1"
echo ""
echo "Shared Services:"
echo "  MongoDB: localhost:27017"
echo "  HBase:   localhost:2180 (ZK), 16030 (UI)"
echo ""
