<?php
$dotenv = Dotenv\Dotenv::createImmutable('./');
$dotenv->load();

$url = isset($_ENV['APP_URL']) ? $_ENV['APP_URL'] : '/';
$cache = (empty($_ENV['CACHE']) || $_ENV['CACHE'] == 'false') ? false : 'cache';
$arenas_path = $_ENV['ARENAS_PATH'];
$apikey_youtube = $_ENV['APIKEY_YOUTUBE'];
$admins = explode(',', $_ENV['ADMINS']);
$discord_client_id = $_ENV['DISCORD_CLIENT_ID'];
$discord_client_secret = $_ENV['DISCORD_CLIENT_SECRET'];
$memcached_host = isset($_ENV['MEMCACHED_HOST']) ? $_ENV['MEMCACHED_HOST'] : '127.0.0.1';
$memcached_port = isset($_ENV['MEMCACHED_PORT']) ? intval($_ENV['MEMCACHED_PORT']) : 11211;

ini_set('session.save_handler', 'memcached');
ini_set('session.save_path', $memcached_host);
ini_set('session.use_strict_mode', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.cookie_samesite', 'Lax');
ini_set('session.gc_maxlifetime', 2592000);
ini_set('session.cookie_lifetime', 2592000);
ini_set('upload_max_filesize', '20M');
ini_set('post_max_size', '25M');

if (!class_exists('Memcached')) {
    die('PHP extension memcached is not installed/enabled');
}
$memcached = new Memcached();
$memcached->addServer($memcached_host, $memcached_port);
