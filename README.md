# Hypersomnia Website
https://hypersomnia.io/

## Installation
```bash
# Install Mainline NGINX from Official Repository
sudo apt install -y curl gnupg2 ca-certificates lsb-release ubuntu-keyring
curl https://nginx.org/keys/nginx_signing.key | gpg --dearmor | sudo tee /usr/share/keyrings/nginx-archive-keyring.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/nginx-archive-keyring.gpg] http://nginx.org/packages/ubuntu `lsb_release -cs` nginx" | sudo tee /etc/apt/sources.list.d/nginx.list
echo -e "Package: *\nPin: origin nginx.org\nPin: release o=nginx\nPin-Priority: 900\n" | sudo tee /etc/apt/preferences.d/99nginx
sudo apt update -y
sudo apt install -y nginx

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_23.x -o nodesource_setup.sh
sudo -E bash nodesource_setup.sh
sudo apt install -y nodejs

# Restrict Access to Port 3000 (Allow Only Localhost)
sudo iptables -A INPUT -p tcp -s 127.0.0.1 --dport 3000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3000 -j DROP

# Deploy the App
cd /var/www/app
npm install
sudo npm install -g pm2

# Initialize SQLite Database (run this if the DB doesn't already exist)
sqlite3 ./private/mmr.db < install.sql

# Start the App
pm2 start app.js
```

## Configuration
```env
ADMINS="76561198051900812,76561198027854878"
STEAM_APIKEY="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
SESSION_SECRET="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
DISCORD_CLIENT_SECRET="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
DISCORD_CLIENT_ID="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
DISCORD_BOT_TOKEN="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
IPINFO_API_TOKEN="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
```

