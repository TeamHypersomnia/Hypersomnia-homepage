#!/bin/bash
# Sign and upload builds to builds/ directory
# Usage: ./sign_and_upload_builds.sh <builds_directory> <version>

set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <builds_directory> <version>"
    echo "Example: $0 /path/to/builds 0.5.2"
    exit 1
fi

BUILDS_DIR="$1"
VERSION="$2"
REMOTE_HOST="ubuntu@hub.hypersomnia.io"
REMOTE_PATH="/var/www/html/builds/$VERSION"

echo "📦 Uploading builds for version $VERSION..."

# Verify builds directory exists
if [ ! -d "$BUILDS_DIR" ]; then
    echo "❌ Error: Builds directory not found: $BUILDS_DIR"
    exit 1
fi

# Create version directory on remote
echo "📁 Creating remote directory..."
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_PATH"

# Upload builds
echo "⬆️  Uploading files..."
rsync -avzP "$BUILDS_DIR/" "$REMOTE_HOST:$REMOTE_PATH/"

# Send Discord notification if webhook URL exists
WEBHOOK_FILE="$HOME/.update_notification_webhook_url"
if [ -f "$WEBHOOK_FILE" ]; then
    WEBHOOK_URL=$(cat "$WEBHOOK_FILE")
    echo "📢 Sending Discord notification..."
    
    curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{\"content\":\"🎮 New Hypersomnia build uploaded: **$VERSION**\nhttps://hypersomnia.io/builds/$VERSION/\"}"
fi

echo "✅ Builds uploaded successfully!"
echo "🌐 Available at: https://hypersomnia.io/builds/$VERSION/"
echo ""
echo "💡 To set as latest, run:"
echo "   ./set_latest_version.sh $VERSION"
