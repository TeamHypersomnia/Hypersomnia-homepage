# Hypersomnia Website
https://hypersomnia.xyz/

## Installation
Node.js
```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
NODE_MAJOR=20
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list
sudo apt-get update
sudo apt-get install nodejs -y
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
```
