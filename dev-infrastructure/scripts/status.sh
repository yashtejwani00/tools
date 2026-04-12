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
    RUNNING=$(docker ps --filter "name=${INSTANCE}-" --format "{{.Names}}" | wc -l)

    if [ "$RUNNING" -gt 0 ]; then
        STATUS="🟢 RUNNING"
        URLS="http://localhost:$UDICHI_PORT"
    else
        STATUS="🔴 STOPPED"
        URLS="-"
    fi

    printf "  %-8s %-12s %s\n" "$INSTANCE:" "$STATUS" "$URLS"
done

echo ""
echo "======================================"
