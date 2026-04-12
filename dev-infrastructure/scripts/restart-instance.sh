#!/bin/bash

# =============================================================================
# Restart a developer instance
# Usage: ./restart-instance.sh <dev-number>
# Example: ./restart-instance.sh dev1
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <dev-number>"
    exit 1
fi

INSTANCE="$1"

$SCRIPT_DIR/stop-instance.sh "$INSTANCE"
sleep 2
$SCRIPT_DIR/start-instance.sh "$INSTANCE"
