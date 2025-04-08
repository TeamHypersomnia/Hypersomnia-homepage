# Hypersomnia Website
https://hypersomnia.xyz/

## Installation
NGINX https://nginx.org/en/linux_packages.html#Ubuntu

Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_23.x -o nodesource_setup.sh
sudo -E bash nodesource_setup.sh
sudo apt-get install -y nodejs
```

Website
```bash
cd /var/www/app
npm install
sudo npm install -g pm2
pm2 start app.js
```

## Configuration
.env
```env
URL="http://localhost:3000/"
ADMINS="76561198051900812,76561198027854878"
STEAM_APIKEY="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
SESSION_SECRET="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
DB_PATH="./private/mmr.db"
REPORT_MATCH_APIKEY="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
SERVER_LIST_JSON="https://hypersomnia.xyz:8420/server_list_json"
DISCORD_CLIENT_SECRET="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
DISCORD_CLIENT_ID="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
DISCORD_BOT_TOKEN="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
IPINFO_API_TOKEN="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```
