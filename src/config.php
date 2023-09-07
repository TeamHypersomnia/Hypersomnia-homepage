<?php
$dotenv = Dotenv\Dotenv::createImmutable('./');
$dotenv->load();

$url = $_ENV['APP_URL'];

if ($dotenv->ifPresent('CACHE')->isBoolean()) {
    $cache = false;
} else {
    $cache = $_ENV['CACHE'];
}

$arenas_path = $_ENV['ARENAS_PATH'];
$apikey_youtube = $_ENV['APIKEY_YOUTUBE'];
$admins = explode(',', $_ENV['ADMINS']);

$discord_client_id = $_ENV['DISCORD_CLIENT_ID'];
$discord_client_secret = $_ENV['DISCORD_CLIENT_SECRET'];
$discord_redirect_uri = $_ENV['DISCORD_REDIRECT_URI'];
