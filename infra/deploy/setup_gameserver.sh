#!/bin/bash
# Setup Hypersomnia Gameserver on a remote host using Ansible
# Usage: ./setup_gameserver.sh <HOST_IP> [SSH_PORT] [SSH_USER]

set -e

HOST=$1
PORT=${2:-22}
USER=${3:-ubuntu}
USE_SUDO_PASS=${4:-no}

if [ -z "$HOST" ]; then
    echo "Usage: $0 <HOST_IP> [SSH_PORT] [SSH_USER] [USE_SUDO_PASS]"
    echo "Example: $0 80.78.132.21 10600 hypersomnia"
    echo "Default assumes passwordless sudo. Pass 'yes' as 4th argument to ask for sudo password."
    exit 1
fi

BECOME_FLAG=""
if [ "$USE_SUDO_PASS" == "yes" ]; then
    BECOME_FLAG="--ask-become-pass"
fi

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
# Go to infra root (parent of deploy)
INFRA_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Setting up gameserver on $USER@$HOST:$PORT..."
echo "📂 Using Ansible playbooks in $INFRA_DIR"

cd "$INFRA_DIR"

# Run Ansible playbook
# We use a comma after HOST to indicate it's a list of hosts, not a file
if [ "$USE_SUDO_PASS" == "yes" ]; then
    echo "🔑 You will be prompted for the sudo password."
fi

ansible-playbook -i "$HOST," playbooks/gameserver_only.yml \
    -u "$USER" \
    -e "ansible_port=$PORT" \
    $BECOME_FLAG

echo "✅ Gameserver setup complete!"
