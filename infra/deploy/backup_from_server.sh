#!/bin/bash
# Backup data from Hypersomnia server
# Usage: ./backup_from_server.sh <hostname> [--hosting]

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <hostname> [--hosting]"
    echo "Example: $0 hypersomnia.xyz"
    echo "Example: $0 hypersomnia.xyz --hosting  # Include hosting/ (builds, etc.)"
    exit 1
fi

SERVER_HOST="$1"
INCLUDE_HOSTING=false

# Check for --hosting flag
if [ "$2" == "--hosting" ]; then
    INCLUDE_HOSTING=true
fi

BACKUP_DIR="backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="${SERVER_HOST}-${TIMESTAMP}.tar.gz"
REMOTE_USER="ubuntu@${SERVER_HOST}"

echo "🔄 Creating backup from ${SERVER_HOST}..."
if [ "$INCLUDE_HOSTING" = false ]; then
    echo "📦 Backup will NOT include hosting/ (use --hosting to include)"
else
    echo "📦 Backup WILL include hosting/ (builds, etc. - may be large!)"
fi
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Build tar command based on flags
if [ "$INCLUDE_HOSTING" = true ]; then
    echo "📁 Creating archive on remote server (including hosting)..."
    ssh "$REMOTE_USER" "cd /var/www/app && tar -czf /tmp/backup-${TIMESTAMP}.tar.gz \
        private/ \
        .env \
        hosting/arenas/ \
        hosting/"
else
    echo "📁 Creating archive on remote server..."
    ssh "$REMOTE_USER" "cd /var/www/app && tar -czf /tmp/backup-${TIMESTAMP}.tar.gz \
        private/ \
        .env \
        hosting/arenas/"
fi

# Download backup
echo "⬇️  Downloading backup..."
scp "$REMOTE_USER:/tmp/backup-${TIMESTAMP}.tar.gz" "$BACKUP_DIR/$BACKUP_NAME"

# Cleanup remote
echo "🧹 Cleaning up remote server..."
ssh "$REMOTE_USER" "rm /tmp/backup-${TIMESTAMP}.tar.gz"

# Also backup webhook URL if exists
echo "🔗 Checking for webhook URL..."
if ssh "$REMOTE_USER" "test -f ~/.update_notification_webhook_url"; then
    scp "$REMOTE_USER:~/.update_notification_webhook_url" "$BACKUP_DIR/update_notification_webhook_url-${SERVER_HOST}"
    echo "✅ Webhook URL backed up"
else
    echo "ℹ️  No webhook URL found"
fi

echo ""
echo "✅ Backup completed!"
echo "📦 File: $BACKUP_DIR/$BACKUP_NAME"
if [ "$INCLUDE_HOSTING" = true ]; then
    echo "⚠️  Note: This backup includes hosting/ and may be very large"
fi
echo ""
echo "To deploy with this backup, run:"
echo "  ansible-playbook -i inventory/production.yml playbooks/site.yml -e \"backup_archive=backups/$BACKUP_NAME\""
