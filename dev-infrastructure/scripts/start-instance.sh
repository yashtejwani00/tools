#!/bin/bash

# =============================================================================
# Start a developer instance
# Usage: ./start-instance.sh <dev-number>
# Example: ./start-instance.sh dev1
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <dev-number>"
    echo "Example: $0 dev1"
    echo "Available instances: dev1, dev2, dev3"
    exit 1
fi

INSTANCE="$1"
INSTANCE_DIR="$INFRA_DIR/instances/$INSTANCE"

if [ ! -d "$INSTANCE_DIR" ]; then
    echo "❌ Instance '$INSTANCE' not found"
    echo "Available instances:"
    ls -1 "$INFRA_DIR/instances/" | grep -E '^dev[1-3]$' | sed 's/^/  - /'
    exit 1
fi

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

HAS_WAR=false
HAS_UDICHI_DIR=false

if [ -d "$INSTANCE_DIR/war" ] && [ -n "$(ls -A "$INSTANCE_DIR/war" 2>/dev/null)" ]; then
    HAS_WAR=true
fi

if [ -d "$INSTANCE_DIR/udichi" ] && [ -f "$INSTANCE_DIR/udichi/bin/start-udichi.sh" ]; then
    HAS_UDICHI_DIR=true
fi

if [ "$HAS_WAR" = false ] && [ "$HAS_UDICHI_DIR" = false ]; then
    echo "⚠️  Warning: No deployable app found."
    echo "   Expected one of:"
    echo "   - WAR files in $INSTANCE_DIR/war/"
    echo "   - Full udichi folder in $INSTANCE_DIR/udichi/"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

cd "$INSTANCE_DIR"
docker compose up -d

echo ""
echo "⏳ Waiting for services to start..."
sleep 5

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
