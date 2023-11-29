# Hypersomnia homepage

Currently hosted at https://hypersomnia.xyz

## Installation

```bash
sudo add-apt-repository ppa:ondrej/php
sudo apt update
sudo apt install -y curl memcached php8.2-fpm php8.2-{zip,curl,xml,memcached}
curl -sSL https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
cd /var/www/html && composer update
```

## Configuration

`/etc/memcached.conf`
```conf
-d
logfile /var/log/memcached.log
-s /var/run/memcached/memcached.sock
-a 666
-m 64
-u memcache
-P /var/run/memcached/memcached.pid
```

`/var/www/html/.env`
```env
# Cache (true or false)
CACHE=false

# Memcached
MEMCACHED_HOST=/var/run/memcached/memcached.sock
MEMCACHED_PORT=0

# Path to arenas
ARENAS_PATH=C:\hypersomnia\content\arenas

# YouTube API Key
APIKEY_YOUTUBE=

# Admins (comma-separated format)
ADMINS=550080230161645592,231574084931026944

# Discord OAuth settings
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
```
