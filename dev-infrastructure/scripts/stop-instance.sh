#!/bin/bash

# =============================================================================
# Stop a developer instance
# Usage: ./stop-instance.sh <dev-number>
# Example: ./stop-instance.sh dev1
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Validate input
if [ $# -lt 1 ]; then
    echo "Usage: $0 <dev-number>"
    echo "Example: $0 dev1"
    exit 1
fi

INSTANCE="$1"
INSTANCE_DIR="$INFRA_DIR/instances/$INSTANCE"

if [ ! -d "$INSTANCE_DIR" ]; then
    echo "❌ Instance '$INSTANCE' not found"
    exit 1
fi

echo "======================================"
echo "  Stopping $INSTANCE"
echo "======================================"

cd "$INSTANCE_DIR"
docker compose down

echo ""
echo "======================================"
echo "  ✅ $INSTANCE Stopped"
echo "======================================"
