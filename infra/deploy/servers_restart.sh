#!/bin/bash
# Restart game servers and masterserver
# Usage: ./servers_restart.sh [masterserver|gameserver-pl|all]

set -e

REMOTE_HOST="ubuntu@hub.hypersomnia.io"

restart_masterserver() {
    echo "🔄 Restarting masterserver..."
    ssh "$REMOTE_HOST" "sudo systemctl restart hypersomnia-masterserver"
    echo "✅ Masterserver restarted"
}

restart_gameserver_pl() {
    echo "🔄 Restarting game server [PL]..."
    ssh "$REMOTE_HOST" "sudo systemctl restart hypersomnia-gameserver-pl"
    echo "✅ Game server [PL] restarted"
}

restart_all() {
    restart_masterserver
    restart_gameserver_pl
}

case "${1:-all}" in
    masterserver)
        restart_masterserver
        ;;
    gameserver-pl)
        restart_gameserver_pl
        ;;
    all)
        restart_all
        ;;
    *)
        echo "Usage: $0 [masterserver|gameserver-pl|all]"
        exit 1
        ;;
esac

echo "🎮 Done!"
