# Hypersomnia Website
https://hypersomnia.xyz/

## Installation
Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_21.x | bash - &&\
sudo apt install -y nodejs
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
ADMINS="XXXXXXXXXXXXXXXXX,XXXXXXXXXXXXXXXXX"
STEAM_APIKEY="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
SESSION_SECRET="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
DB_PATH="./private/mmr.db"
REPORT_MATCH_APIKEY="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
SERVER_LIST_JSON="http://hypersomnia.xyz:8420/server_list_json"
```
