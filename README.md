# Hypersomnia homepage

Currently hosted at https://hypersomnia.xyz/

## Installation

```bash
sudo add-apt-repository ppa:ondrej/php
sudo apt update
sudo apt install php8.2 php8.2-zip php8.2-curl -y

php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php
php -r "unlink('composer-setup.php');"
sudo mv composer.phar /usr/local/bin/composer

cd /var/www/html
composer update
```

## Configuration

```text
# .env

# Base URL
APP_URL=http://localhost/Hypersomnia-homepage/

# Cache setting (path to cache directory or false)
CACHE=false

# Path to arenas directory
ARENAS_PATH=C:\hypersomnia\content\arenas

# YouTube API Key
APIKEY_YOUTUBE=

# Admins (comma-separated format)
ADMINS=550080230161645592,231574084931026944

# Discord OAuth settings
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=
```
