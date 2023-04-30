# Hypersomnia homepage

Currently hosted at https://hypersomnia.xyz/

## Installation

```bash
sudo add-apt-repository ppa:ondrej/php
sudo apt update
sudo apt install php8.2 -y

cd /var/www/html
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php
php -r "unlink('composer-setup.php');"
sudo mv composer.phar /usr/local/bin/composer
composer require "twig/twig:^3.0"
composer require bramus/router ~1.6

sudo chmod 777 /var/www/cache
```
