#!/bin/bash

# =============================================================================
# Udichi Startup Script for Docker Container
# This is a template - customize based on your actual start-udichi.sh
# =============================================================================

set -e

echo "======================================"
echo "  Starting Udichi Services"
echo "  Instance: ${DEV_NUMBER:-unknown}"
echo "======================================"
echo ""

# Environment info
echo "Environment:"
echo "  DEV_NUMBER: $DEV_NUMBER"
echo "  UDICHI_PORT: $UDICHI_PORT"
echo "  KAFKA_BOOTSTRAP_SERVERS: $KAFKA_BOOTSTRAP_SERVERS"
echo "  ZOOKEEPER_CONNECT: $ZOOKEEPER_CONNECT"
echo "  MONGODB_URI: ${MONGODB_URI:0:50}..."
echo ""

# Set Java options
export JAVA_OPTS="${JAVA_OPTS:--Xms512m -Xmx2g -XX:+UseG1GC}"
echo "Java Options: $JAVA_OPTS"
echo ""

# Wait for dependencies using bash TCP checks only.
wait_for_tcp() {
    local host="$1"
    local port="$2"
    local label="$3"
    local retries=60
    local count=0

    echo "⏳ Waiting for ${label} (${host}:${port})..."
    until bash -c "echo > /dev/tcp/${host}/${port}" 2>/dev/null; do
        count=$((count + 1))
        if [ "$count" -ge "$retries" ]; then
            echo "❌ ${label} did not become reachable in time"
            exit 1
        fi
        echo "  ${label} not ready, waiting..."
        sleep 2
    done
    echo "✅ ${label} is reachable"
}

wait_for_tcp "dev${DEV_NUMBER}-kafka" "9092" "Kafka"
wait_for_tcp "dev${DEV_NUMBER}-zookeeper" "2181" "Zookeeper"

echo ""

# Create necessary directories
mkdir -p /opt/udichi/logs

echo "⚠️  NOTE: This is a template start script!"
echo "   Please customize with your actual service startup commands."
echo ""

# Keep container running (for testing)
echo "🔄 Container is running. Press Ctrl+C to stop."
tail -f /dev/null
