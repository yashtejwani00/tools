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

# Wait for dependencies
echo "⏳ Waiting for Kafka..."
until kafka-broker-api-versions --bootstrap-server "$KAFKA_BOOTSTRAP_SERVERS" &>/dev/null; do
    echo "  Kafka not ready, waiting..."
    sleep 2
done
echo "✅ Kafka is ready"

echo "⏳ Waiting for Zookeeper..."
until echo "ruok" | nc "dev${DEV_NUMBER}-zookeeper" 2181 | grep -q "imok"; do
    echo "  Zookeeper not ready, waiting..."
    sleep 2
done
echo "✅ Zookeeper is ready"

echo ""

# Create necessary directories
mkdir -p /opt/udichi/logs

echo "⚠️  NOTE: This is a template start script!"
echo "   Please customize with your actual service startup commands."
echo ""

# Keep container running (for testing)
echo "🔄 Container is running. Press Ctrl+C to stop."
tail -f /dev/null
