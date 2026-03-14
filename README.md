# Hypersomnia Website

https://hypersomnia.io/

Use Ansible playbooks to setup.

## Configuration

Example .env file:

```env
NODE_ENV=production
PORT=3000
SESSION_SECRET=your-very-long-random-secret-key-at-least-32-chars
STEAM_APIKEY=YOUR_STEAM_API_KEY
IPINFO_API_TOKEN=YOUR_IPINFO_TOKEN
DISCORD_CLIENT_ID=YOUR_DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=YOUR_DISCORD_CLIENT_SECRET
DISCORD_BOT_TOKEN=YOUR_DISCORD_BOT_TOKEN
ADMINS=76561198012345678,76561198087654321
```

## Logs

The app runs under **PM2** in production (deployed via Ansible). All `[report_match]`-prefixed log lines are emitted on every code path — successes, skips, validation failures, and errors with full stack traces.

```bash
# Live log stream
pm2 logs app

# Last 200 lines
pm2 logs app --lines 200

# Errors only
pm2 logs app --err --lines 100

# Log files on disk
~/.pm2/logs/app-out.log    # stdout (console.log)
~/.pm2/logs/app-error.log  # stderr (console.error)
```

To diagnose a match that wasn't recorded:

```bash
# Check for validation failures or exceptions around a specific time
grep "\[report_match\]" ~/.pm2/logs/app-out.log | tail -50
grep "\[report_match\]" ~/.pm2/logs/app-error.log | tail -50
```

## Local development

```bash
# Start with a test API key pre-seeded (api_key=pl, server_id=pl)
./test_server.sh
```

See [`docs/report_match_logic.md`](docs/report_match_logic.md) for full documentation on MMR calculation, abandon rules, and happy hours.