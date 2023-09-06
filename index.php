<?php
require_once('vendor/autoload.php');

$router = new \Bramus\Router\Router();

/* GENERAL */
$router->set404(fn() => require_once('src/404.php'));
$router->get('/download/(\w+)', fn($arena) => require_once('src/download.php'));
$router->post('/upload', fn() => require_once('src/upload.php'));

/* NAV */
$router->get('/', fn() => require_once('src/index.php'));
$router->get('/guide', fn() => require_once('src/guide.php'));
$router->mount('/arenas', fn() => [
	$router->get('/', fn() => require_once('src/arenas.php')),
	$router->get('/(\w+)', fn($arena) => require_once('src/arena.php')),
	$router->get('/(\w+)/{file}', fn($arena, $file) => require_once('src/file.php'))
]);
$router->get('/weapons', fn() => require_once('src/weapons.php'));
$router->mount('/servers', fn() => [
	$router->get('/', fn() => require_once('src/servers.php')),
	$router->get('/{address}', fn($address) => require_once('src/servers.php'))
]);

/* FOOTER */
$router->get('/disclaimer', fn() => require_once('src/disclaimer.php'));
$router->get('/cookie-policy', fn() => require_once('src/cookie_policy.php'));
$router->get('/contact', fn() => require_once('src/contact.php'));
$router->get('/press', fn() => require_once('src/press.php'));
$router->get('/statistics', fn() => require_once('src/statistics.php'));

/* ADMIN */
$router->mount('/admin', fn() => [
	$router->match('GET|POST', '/', fn() => require_once('src/admin/login.php')),
	$router->get('/system', fn() => require_once('src/admin/system.php')),
	$router->get('/visitors', fn() => require_once('src/admin/visitors.php')),
	$router->get('/authorized-mappers', fn() => require_once('src/admin/authorized_mappers.php')),
	$router->get('/logout', fn() => require_once('src/admin/logout.php'))
]);

$router->run();
