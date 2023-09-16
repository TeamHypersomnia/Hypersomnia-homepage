<?php
$dotenv = Dotenv\Dotenv::createImmutable('./');
$dotenv->load();

$url = $_ENV['APP_URL'];
$cache = (empty($_ENV['CACHE']) || $_ENV['CACHE'] == 'false') ? false : 'cache';
$arenas_path = $_ENV['ARENAS_PATH'];
$apikey_youtube = $_ENV['APIKEY_YOUTUBE'];
$admins = explode(',', $_ENV['ADMINS']);
$discord_client_id = $_ENV['DISCORD_CLIENT_ID'];
$discord_client_secret = $_ENV['DISCORD_CLIENT_SECRET'];
$memcached_host = isset($_ENV['MEMCACHED_HOST']) ? $_ENV['MEMCACHED_HOST'] : '127.0.0.1';
$memcached_port = isset($_ENV['MEMCACHED_PORT']) ? intval($_ENV['MEMCACHED_PORT']) : 11211;

if (!class_exists('Memcached')) {
    die('PHP extension memcached is not installed/enabled');
}
$memcached = new Memcached();
$memcached->addServer($memcached_host, $memcached_port);
