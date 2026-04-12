#!/bin/bash

# =============================================================================
# View logs for a developer instance
# Usage: ./logs.sh <dev-number> [service-name] [-f]
# Example: ./logs.sh dev1          # All services
#          ./logs.sh dev1 udichi   # Just udichi
#          ./logs.sh dev1 -f       # Follow all logs
#          ./logs.sh dev1 udichi -f # Follow udichi logs
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <dev-number> [service-name] [-f]"
    echo ""
    echo "Services: zookeeper, kafka, udichi"
    echo ""
    echo "Examples:"
    echo "  $0 dev1              # Show all logs"
    echo "  $0 dev1 -f           # Follow all logs"
    echo "  $0 dev1 udichi       # Show udichi logs"
    echo "  $0 dev1 udichi -f    # Follow udichi logs"
    exit 1
fi

INSTANCE="$1"
INSTANCE_DIR="$INFRA_DIR/instances/$INSTANCE"

if [ ! -d "$INSTANCE_DIR" ]; then
    echo "❌ Instance '$INSTANCE' not found"
    exit 1
fi

shift  # Remove instance name from args

cd "$INSTANCE_DIR"
docker compose logs "$@"
