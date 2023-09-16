<?php
require_once 'vendor/autoload.php';

$router = new \Bramus\Router\Router();

// Main
$router->set404(fn () => require_once 'src/404.php');
$router->get('/download/(\w+)', fn ($file) => require_once 'src/download.php');
$router->get('/download-zip/(\w+)', fn ($arena) => require_once 'src/download_zip.php');
$router->post('/upload', fn () => require_once 'src/upload.php');
$router->get('/discord', fn () => require_once 'src/discord.php');
$router->get('/profile', fn () => require_once 'src/profile.php');
$router->post('/logout', fn () => require_once 'src/logout.php');

// Nav
$router->get('/', fn () => require_once 'src/index.php');
$router->get('/guide', fn () => require_once 'src/guide.php');
$router->mount('/arenas', fn () => [
	$router->get('/', fn () => require_once 'src/arenas.php'),
	$router->get('/(\w+)', fn ($arena) => require_once 'src/arena.php'),
	$router->get('/(\w+)/{file}', fn ($arena, $file) => require_once 'src/file.php')
]);
$router->get('/weapons', fn () => require_once 'src/weapons.php');
$router->mount('/servers', fn () => [
	$router->get('/', fn () => require_once 'src/servers.php'),
	$router->get('/{address}', fn ($address) => require_once 'src/servers.php')
]);

// Footer
$router->get('/disclaimer', fn () => require_once 'src/disclaimer.php');
$router->get('/cookie-policy', fn () => require_once 'src/cookie_policy.php');
$router->get('/contact', fn () => require_once 'src/contact.php');
$router->get('/press', fn () => require_once 'src/press.php');
$router->get('/statistics', fn () => require_once 'src/statistics.php');

// Admin
$router->mount('/admin', fn () => [
	$router->get('/system', fn () => require_once 'src/admin/system.php'),
	$router->get('/system/packages', fn ($packages = 1) => require_once 'src/admin/system.php'),
	$router->get('/visitors', fn () => require_once 'src/admin/visitors.php'),
	$router->get('/users', fn () => require_once 'src/admin/users.php'),
	$router->match('GET|POST', '/creators', fn () => require_once 'src/admin/creators.php'),
	$router->match('GET|POST', '/creators/{creator}', fn ($creator) => require_once 'src/admin/creator.php'),
]);

// Ajax
$router->mount('/ajax', fn () => [
	$router->post('/like-arena', fn () => require_once 'src/ajax/like_arena.php')
]);

$router->run();
