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
