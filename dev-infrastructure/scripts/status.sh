#!/bin/bash

# =============================================================================
# Show status of all developer instances
# Usage: ./status.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo "======================================"
echo "  Dev Infrastructure Status"
echo "======================================"
echo ""

echo "🌐 Shared Services:"
echo "------------------"
if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "shared-(mongodb|zookeeper|hbase)" > /dev/null 2>&1; then
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "shared-(mongodb|zookeeper|hbase)" | sed 's/^/  /'
else
    echo "  ⚠️  Shared services not running"
fi

echo ""
echo "🔷 Developer Instances:"
echo "----------------------"

for INSTANCE_DIR in "$INFRA_DIR"/instances/dev[1-3]; do
    [ -d "$INSTANCE_DIR" ] || continue
    INSTANCE="$(basename "$INSTANCE_DIR")"

    if [ ! -f "$INSTANCE_DIR/.env" ]; then
        continue
    fi

    source "$INSTANCE_DIR/.env"
    UDICHI_STATE=$(docker inspect -f '{{.State.Status}}' "${INSTANCE}-udichi" 2>/dev/null || echo "missing")
    KAFKA_STATE=$(docker inspect -f '{{.State.Status}}' "${INSTANCE}-kafka" 2>/dev/null || echo "missing")
    ZK_STATE=$(docker inspect -f '{{.State.Status}}' "${INSTANCE}-zookeeper" 2>/dev/null || echo "missing")

    if [ "$UDICHI_STATE" = "running" ]; then
        STATUS="🟢 RUNNING"
        URLS="http://localhost:$UDICHI_PORT"
    elif [ "$UDICHI_STATE" = "restarting" ]; then
        STATUS="🟠 APP_RESTARTING"
        URLS="http://localhost:$UDICHI_PORT"
    elif [ "$KAFKA_STATE" = "running" ] || [ "$ZK_STATE" = "running" ]; then
        STATUS="🟡 BROKER_ONLY"
        URLS="kafka:localhost:$KAFKA_EXTERNAL_PORT"
    else
        STATUS="🔴 STOPPED"
        URLS="-"
    fi

    printf "  %-8s %-12s %s\n" "$INSTANCE:" "$STATUS" "$URLS"
done

echo ""
echo "======================================"
