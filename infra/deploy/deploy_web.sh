#!/bin/bash
# Deploy web build (WASM version) to play.hypersomnia.io
# Usage: ./deploy_web.sh <path_to_web_build_directory>

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_web_build_directory>"
    echo "Example: $0 /path/to/Hypersomnia-web-build"
    exit 1
fi

WEB_BUILD_DIR="$1"
REMOTE_HOST="ubuntu@play.hypersomnia.io"
REMOTE_PATH="/var/www/html"

echo "🚀 Deploying web build to play.hypersomnia.io..."

# Verify the build directory exists
if [ ! -d "$WEB_BUILD_DIR" ]; then
    echo "❌ Error: Build directory not found: $WEB_BUILD_DIR"
    exit 1
fi

# Check for essential files
if [ ! -f "$WEB_BUILD_DIR/index.html" ]; then
    echo "❌ Error: index.html not found in build directory"
    exit 1
fi

# Rsync the web build to the server
echo "📦 Syncing files..."
rsync -avzP --delete "$WEB_BUILD_DIR/" "$REMOTE_HOST:$REMOTE_PATH/"

echo "✅ Web build deployed successfully!"
echo "🌐 Visit: https://play.hypersomnia.io"
