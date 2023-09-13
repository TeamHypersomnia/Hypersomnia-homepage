# Hypersomnia homepage

Currently hosted at https://hypersomnia.xyz/

## Installation

```bash
sudo add-apt-repository ppa:ondrej/php
sudo apt update
sudo apt install memcached php8.2 php8.2-{zip,curl,xml,memcached} -y

php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php
php -r "unlink('composer-setup.php');"
sudo mv composer.phar /usr/local/bin/composer

cd /var/www/html
composer update
```

## Configuration

php.ini
```ini
session.save_handler = memcached
session.save_path = "localhost:11211"
session.use_strict_mode = 1
session.use_only_cookies = 1
session.cookie_httponly = 1
session.cookie_secure = 1
session.cookie_samesite = "Lax"
session.gc_maxlifetime = 86400
```

apache2.conf
```conf
ServerSignature Off
ServerTokens Prod
```

.env
```env
# Base URL
APP_URL=http://localhost/Hypersomnia-homepage/

# Cache (true or false)
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
```
