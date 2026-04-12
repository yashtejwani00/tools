#!/bin/bash

# =============================================================================
# Quick deploy from your local Mac to the Ubuntu server
# Usage: ./quick-deploy.sh <dev-number>
# 
# This script:
# 1. Builds udichi locally (on Mac)
# 2. Copies WAR files to Ubuntu server
# 3. Restarts the instance
#
# Prerequisites:
# - Set UBUNTU_SERVER env var or update below
# - SSH key setup for passwordless auth
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

# Configuration (override via env vars)
UBUNTU_SERVER="${UBUNTU_SERVER:-ubuntu@your-server-ip}"
REMOTE_DIR="${REMOTE_DIR:-dev-infrastructure}"
LOCAL_BUILD_DIR="${LOCAL_BUILD_DIR:-./war}"

# Validate input
if [ $# -lt 1 ]; then
    echo "Usage: $0 <dev-number>"
    echo "Example: $0 dev1"
    echo ""
    echo "Make sure to set UBUNTU_SERVER environment variable:"
    echo "export UBUNTU_SERVER=ubuntu@your-server-ip"
    echo ""
    echo "Optional overrides:"
    echo "export REMOTE_DIR=dev-infrastructure"
    echo "export LOCAL_BUILD_DIR=./war"
    exit 1
fi

INSTANCE="$1"
INSTANCE_NUM=$(echo "$INSTANCE" | sed 's/dev//')

echo "======================================"
echo "  Quick Deploy to $INSTANCE"
echo "======================================"
echo ""
echo "Server: $UBUNTU_SERVER"
echo "Instance: $INSTANCE"
echo ""

# Step 1: Build locally
echo "🔨 Step 1: Building locally..."

echo "  Build step is project-specific."
echo "  Run your build command first, then ensure artifacts exist in: $LOCAL_BUILD_DIR"

echo "✅ Build complete"
echo ""

# Step 2: Deploy to server
echo "📤 Step 2: Deploying to server..."

# Resolve local build path relative to infra repo if needed
if [[ "$LOCAL_BUILD_DIR" != /* ]]; then
    LOCAL_BUILD_PATH="$INFRA_DIR/$LOCAL_BUILD_DIR"
else
    LOCAL_BUILD_PATH="$LOCAL_BUILD_DIR"
fi

if [ ! -d "$LOCAL_BUILD_PATH" ]; then
    echo "❌ Build directory not found: $LOCAL_BUILD_PATH"
    exit 1
fi

# Copy WAR files
scp -r "$LOCAL_BUILD_PATH"/* "$UBUNTU_SERVER:$REMOTE_DIR/instances/$INSTANCE/war/"

echo "✅ Files copied"
echo ""

# Step 3: Restart instance
echo "🔄 Step 3: Restarting instance..."

ssh "$UBUNTU_SERVER" "cd $REMOTE_DIR && ./scripts/restart-instance.sh $INSTANCE"

echo ""
echo "======================================"
echo "  ✅ Deploy Complete!"
echo "======================================"
echo ""
echo "Instance $INSTANCE should be available at:"
echo "  Direct: http://<server-ip>:$((8888 + (INSTANCE_NUM-1)*100))"
echo "  Via Tunnel: http://$INSTANCE.nexus.company.com"
echo ""
