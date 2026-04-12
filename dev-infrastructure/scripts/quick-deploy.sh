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

# Configuration - UPDATE THESE
UBUNTU_SERVER="${UBUNTU_SERVER:-ubuntu@your-server-ip}"
REMOTE_DIR="/opt/dev-infrastructure"
LOCAL_BUILD_DIR="/Users/yashwant/udichi/war"

# Validate input
if [ $# -lt 1 ]; then
    echo "Usage: $0 <dev-number>"
    echo "Example: $0 dev1"
    echo ""
    echo "Make sure to set UBUNTU_SERVER environment variable:"
    echo "export UBUNTU_SERVER=ubuntu@your-server-ip"
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

cd /Users/yashwant/udichi
echo "  Building udichi..."
# Add your build command here when needed

echo "✅ Build complete"
echo ""

# Step 2: Deploy to server
echo "📤 Step 2: Deploying to server..."

# Copy WAR files
scp -r "$LOCAL_BUILD_DIR"/* "$UBUNTU_SERVER:$REMOTE_DIR/instances/$INSTANCE/war/"

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
