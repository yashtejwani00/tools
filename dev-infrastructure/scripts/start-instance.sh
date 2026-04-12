#!/bin/bash

# =============================================================================
# Start a developer instance
# Usage: ./start-instance.sh <dev-number>
# Example: ./start-instance.sh dev1
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Validate input
if [ $# -lt 1 ]; then
    echo "Usage: $0 <dev-number>"
    echo "Example: $0 dev1"
    echo "Available instances: dev1, dev2, ..., dev10"
    exit 1
fi

INSTANCE="$1"
INSTANCE_DIR="$INFRA_DIR/instances/$INSTANCE"

# Validate instance exists
if [ ! -d "$INSTANCE_DIR" ]; then
    echo "❌ Instance '$INSTANCE' not found"
    echo "Available instances:"
    ls -1 "$INFRA_DIR/instances/" | grep -E '^dev[0-9]+$' | sed 's/^/  - /'
    exit 1
fi

# Load environment variables
source "$INSTANCE_DIR/.env"

echo "======================================"
echo "  Starting $INSTANCE"
echo "======================================"
echo ""
echo "Configuration:"
echo "  Dev Number:     $DEV_NUMBER"
echo "  Port Offset:    $PORT_OFFSET"
echo "  udichi Port:    $UDICHI_PORT"
echo "  Kafka Port:     $KAFKA_PORT"
echo "  Zookeeper Port: $ZK_PORT"
echo ""

# Check if WAR files exist
if [ ! -d "$INSTANCE_DIR/war" ] || [ -z "$(ls -A $INSTANCE_DIR/war 2>/dev/null)" ]; then
    echo "⚠️  Warning: No WAR files found in $INSTANCE_DIR/war/"
    echo "   Please deploy your application first:"
    echo "   ./deploy.sh $INSTANCE"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Start the instance
cd "$INSTANCE_DIR"
docker compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

# Check status
echo ""
echo "🔍 Service Status:"
docker compose ps

echo ""
echo "======================================"
echo "  ✅ $INSTANCE Started!"
echo "======================================"
echo ""
echo "Access URLs:"
echo "  udichi:          http://localhost:$UDICHI_PORT"
echo ""
echo "View logs:"
echo "  ./scripts/logs.sh $INSTANCE"
echo ""
echo "Stop instance:"
echo "  ./scripts/stop-instance.sh $INSTANCE"
echo ""
