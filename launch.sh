#!/usr/bin/env bash
# launch.sh — start the tournament visualizer on a Linux LAN party machine.
# Verifies dependencies, installs/repairs them if needed, then runs node app.js.
#
# Usage:
#   ./launch.sh                 # port 3000, auto-detect tournament dir
#   PORT=4000 ./launch.sh       # custom port
#   TOURNAMENT_DIR=... ./launch.sh
#
# Requirements: Node.js >= 18, npm. The script reports anything missing.

set -euo pipefail

cd "$(dirname "$(readlink -f "$0")")"

red()    { printf '\033[31m%s\033[0m\n' "$*" >&2; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
cyan()   { printf '\033[36m%s\033[0m\n' "$*"; }

fail() { red "[FAIL] $*"; exit 1; }
ok()   { green "[OK]   $*"; }
warn() { yellow "[WARN] $*"; }
info() { cyan "[..]   $*"; }

# ---------- sanity ----------
[ -f package.json ] || fail "package.json not found in $(pwd) — run this script from the repo root."
[ -f app.js ]       || fail "app.js not found in $(pwd) — run this script from the repo root."

# ---------- node ----------
if ! command -v node >/dev/null 2>&1; then
  red "[FAIL] node.js is not installed."
  cat >&2 <<'EOF'

Install Node.js >= 18:
  Arch:    sudo pacman -S nodejs npm
  Ubuntu:  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs
  Fedora:  sudo dnf install -y nodejs npm
  Other:   https://nodejs.org/en/download
EOF
  exit 1
fi

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)
[ "$NODE_MAJOR" -ge 18 ] || fail "Node $(node -v) is too old, need >= 18."
ok "node $(node -v)"

command -v npm >/dev/null 2>&1 || fail "npm is missing (normally ships with node.js)."

# ---------- helpers ----------
check_build_tools() {
  missing=""
  for t in make g++ python3; do
    command -v "$t" >/dev/null 2>&1 || missing="$missing $t"
  done
  if [ -n "$missing" ]; then
    red "[FAIL] Missing build tools:$missing"
    red "       Install:"
    red "         Arch:   sudo pacman -S base-devel python"
    red "         Ubuntu: sudo apt install build-essential python3"
    red "         Fedora: sudo dnf install gcc-c++ make python3"
    return 1
  fi
  return 0
}

# Real load test: opens an in-memory db so the native .node binding is actually dlopen'd.
sqlite_works() {
  node -e "const D=require('better-sqlite3'); new D(':memory:').close()" >/dev/null 2>&1
}

# On Arch with very new GCC/clang, node-gyp may pick a compiler that chokes on
# Node's headers (e.g. clang refuses -flto=<N>). Force GNU toolchain when present.
gnu_env() {
  if command -v gcc >/dev/null 2>&1 && command -v g++ >/dev/null 2>&1; then
    echo "CC=gcc CXX=g++"
  fi
}

# ---------- dependencies ----------
need_install=0
[ -d node_modules ] || need_install=1
[ -f package-lock.json ] && [ package-lock.json -nt node_modules ] && need_install=1

NODE_ABI=$(node -p "process.versions.modules")
ABI_STAMP=node_modules/.node-abi
need_rebuild_sqlite=0
if [ -d node_modules ]; then
  if [ ! -f "$ABI_STAMP" ] || [ "$(cat "$ABI_STAMP" 2>/dev/null)" != "$NODE_ABI" ]; then
    warn "Node.js version differs from the last install — better-sqlite3 will be rebuilt (ABI=$NODE_ABI)."
    need_rebuild_sqlite=1
  fi
fi

if [ "$need_install" = 1 ]; then
  info "Running npm install…"
  npm install --no-audit --no-fund || fail "npm install failed. See log above."
  ok "Dependencies installed."
else
  ok "Dependencies are up to date."
fi

# ---------- better-sqlite3 sanity / repair ----------
if [ "$need_rebuild_sqlite" = 1 ] || ! sqlite_works; then
  info "Repairing better-sqlite3 (step 1/3: try prebuild via npm rebuild)…"
  npm rebuild better-sqlite3 --no-audit --no-fund >/tmp/launch-sqlite-rebuild.log 2>&1 || true

  if ! sqlite_works; then
    info "Step 2/3: prebuild unavailable — compile from source with GNU toolchain."
    check_build_tools || { red "Full log: /tmp/launch-sqlite-rebuild.log"; exit 1; }
    # shellcheck disable=SC2046
    env $(gnu_env) npm rebuild better-sqlite3 --build-from-source --no-audit --no-fund \
      >/tmp/launch-sqlite-rebuild.log 2>&1 || true
  fi

  if ! sqlite_works; then
    # Last resort: the locked version may simply not support this Node major
    # (e.g. Arch ships Node 26 but lockfile pins better-sqlite3@12.6.2 which
    # only supports 20-25). Try the latest matching better-sqlite3 ad-hoc —
    # --no-save keeps package.json / lock untouched.
    info "Step 3/3: locked version may be incompatible with Node $NODE_MAJOR. Trying latest better-sqlite3 (no-save)…"
    check_build_tools || { red "Full log: /tmp/launch-sqlite-rebuild.log"; exit 1; }
    # shellcheck disable=SC2046
    env $(gnu_env) npm install better-sqlite3@latest --no-save --no-audit --no-fund \
      >>/tmp/launch-sqlite-rebuild.log 2>&1 || true
  fi

  if ! sqlite_works; then
    red "better-sqlite3 still does not load after all repair attempts."
    red "Full log: /tmp/launch-sqlite-rebuild.log"
    red "Common causes:"
    red "  - very new Node.js (try LTS 22): use nvm or your distro's nodejs-lts package"
    red "  - missing system headers for the C++ compiler"
    fail "Setup failed."
  fi
fi
echo "$NODE_ABI" > "$ABI_STAMP"
ok "better-sqlite3 OK (ABI $NODE_ABI, version $(node -p "require('better-sqlite3/package.json').version"))"

# ---------- port ----------
PORT="${PORT:-3000}"
if command -v lsof >/dev/null 2>&1; then
  existing=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$existing" ]; then
    warn "Port $PORT is busy (PID: $existing) — killing."
    kill $existing 2>/dev/null || true
    sleep 1
  fi
elif command -v ss >/dev/null 2>&1; then
  if ss -ltn 2>/dev/null | awk '{print $4}' | grep -E "[:.]${PORT}\$" >/dev/null; then
    warn "Port $PORT is busy. Install 'lsof' so I can free it, or pick another: PORT=3001 ./launch.sh"
    fail "Port $PORT busy."
  fi
fi
export PORT

# ---------- tournament dir ----------
if [ -z "${TOURNAMENT_DIR:-}" ]; then
  hyper_dir="$HOME/.config/Hypersomnia/user"
  if [ -d "$hyper_dir" ]; then
    export TOURNAMENT_DIR="$hyper_dir"
    if ! ls "$hyper_dir"/tournament.*.json >/dev/null 2>&1; then
      warn "No tournament.*.json files in $hyper_dir yet — Hypersomnia will create them when a tournament starts."
    fi
  else
    export TOURNAMENT_DIR="$(pwd)/tests/tournaments"
    warn "Directory $hyper_dir not found (Hypersomnia not installed?) — using sample data from tests/tournaments."
    warn "To point elsewhere: TOURNAMENT_DIR=/some/path ./launch.sh"
  fi
fi
ok "TOURNAMENT_DIR = $TOURNAMENT_DIR"

# ---------- LAN url ----------
lan_ip=$(ip -4 -o addr show scope global 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n1 || true)

echo
echo "──────────────────────────────────────────────"
green "  Tournament visualizer starting on port $PORT"
echo "  Local: http://localhost:$PORT/tournament"
if [ -n "$lan_ip" ]; then
  echo "  LAN:   http://$lan_ip:$PORT/tournament"
else
  echo "  LAN:   http://<your-ip>:$PORT/tournament"
fi
echo "──────────────────────────────────────────────"
echo

exec node app.js
