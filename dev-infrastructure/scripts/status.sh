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

# Shared services
echo "🌐 Shared Services:"
echo "------------------"
if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "shared-(mongodb|hbase)" > /dev/null 2>&1; then
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "shared-(mongodb|hbase)" | sed 's/^/  /'
else
    echo "  ⚠️  Shared services not running"
fi

echo ""
echo "🔷 Developer Instances:"
echo "----------------------"

# Check each instance
for i in {1..10}; do
    INSTANCE="dev$i"
    INSTANCE_DIR="$INFRA_DIR/instances/$INSTANCE"
    
    if [ ! -f "$INSTANCE_DIR/.env" ]; then
        continue
    fi
    
    source "$INSTANCE_DIR/.env"
    
    # Check if containers are running
    RUNNING=$(docker ps --filter "name=dev${i}-" --format "{{.Names}}" | wc -l)
    
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
