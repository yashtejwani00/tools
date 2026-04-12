#!/bin/bash

# =============================================================================
# Deploy application to a developer instance
# Usage: ./deploy.sh <dev-number> [path-to-war-files]
# Example: 
#   ./deploy.sh dev1                           # Deploy local war/ folder
#   ./deploy.sh dev1 /home/user/build/war      # Deploy from specific path
#   ./deploy.sh dev1 --restart                 # Deploy and restart
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Validate input
if [ $# -lt 1 ]; then
    echo "Usage: $0 <dev-number> [path-to-war-files] [--restart]"
    echo ""
    echo "Examples:"
    echo "  $0 dev1                           # Deploy from local war/ folder"
    echo "  $0 dev1 /path/to/build/war        # Deploy from specific path"
    echo "  $0 dev1 --restart                 # Deploy and restart instance"
    echo "  $0 dev1 /path/to/war --restart    # Deploy from path and restart"
    exit 1
fi

INSTANCE="$1"
INSTANCE_DIR="$INFRA_DIR/instances/$INSTANCE"
WAR_SOURCE=""
RESTART=false

# Validate instance
if [ ! -d "$INSTANCE_DIR" ]; then
    echo "❌ Instance '$INSTANCE' not found"
    exit 1
fi

# Parse remaining arguments
shift
for arg in "$@"; do
    case $arg in
        --restart)
            RESTART=true
            ;;
        *)
            if [ -z "$WAR_SOURCE" ]; then
                WAR_SOURCE="$arg"
            fi
            ;;
    esac
done

# Default to local war/ folder if not specified
if [ -z "$WAR_SOURCE" ]; then
    WAR_SOURCE="./war"
fi

# Validate source
if [ ! -d "$WAR_SOURCE" ]; then
    echo "❌ WAR source directory not found: $WAR_SOURCE"
    exit 1
fi

if [ -z "$(ls -A $WAR_SOURCE 2>/dev/null)" ]; then
    echo "❌ No files found in: $WAR_SOURCE"
    exit 1
fi

echo "======================================"
echo "  Deploying to $INSTANCE"
echo "======================================"
echo ""
echo "Source: $WAR_SOURCE"
echo "Target: $INSTANCE_DIR/war/"
echo ""

# Create backup of current deployment
if [ -d "$INSTANCE_DIR/war" ] && [ -n "$(ls -A $INSTANCE_DIR/war 2>/dev/null)" ]; then
    BACKUP_DIR="$INSTANCE_DIR/war.backup.$(date +%Y%m%d_%H%M%S)"
    echo "📦 Creating backup: $BACKUP_DIR"
    cp -r "$INSTANCE_DIR/war" "$BACKUP_DIR"
fi

# Clear old WAR files
echo "🗑️  Clearing old WAR files..."
rm -rf "$INSTANCE_DIR/war"/*

# Copy new WAR files
echo "📋 Copying new WAR files..."
cp -r "$WAR_SOURCE"/* "$INSTANCE_DIR/war/"

# List deployed files
echo ""
echo "📁 Deployed files:"
ls -la "$INSTANCE_DIR/war/"

echo ""
echo "======================================"
echo "  ✅ Deployment Complete!"
echo "======================================"

if [ "$RESTART" = true ]; then
    echo ""
    echo "🔄 Restarting instance..."
    $SCRIPT_DIR/restart-instance.sh "$INSTANCE"
else
    echo ""
    echo "⚠️  Instance NOT restarted"
    echo "   To restart: ./restart-instance.sh $INSTANCE"
    echo "   Or redeploy with: ./deploy.sh $INSTANCE --restart"
fi
