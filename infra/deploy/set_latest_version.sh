#!/bin/bash
# Set a specific version as latest in builds directory
# Usage: ./set_latest_version.sh <version>

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 0.5.2"
    exit 1
fi

VERSION="$1"
REMOTE_HOST="ubuntu@hub.hypersomnia.io"
BUILDS_PATH="/var/www/html/builds"

echo "🔗 Setting version $VERSION as latest..."

# Check if version exists on remote
ssh "$REMOTE_HOST" "
    if [ ! -d $BUILDS_PATH/$VERSION ]; then
        echo '❌ Error: Version $VERSION not found in builds directory'
        exit 1
    fi
    
    # Remove old latest symlink if exists
    rm -f $BUILDS_PATH/latest
    
    # Create new symlink
    ln -s $VERSION $BUILDS_PATH/latest
    
    echo '✅ Latest now points to: $VERSION'
    ls -la $BUILDS_PATH/latest
"

echo "🌐 Latest version: https://hypersomnia.io/builds/latest/"
