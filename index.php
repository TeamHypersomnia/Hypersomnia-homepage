<?php
require_once 'vendor/autoload.php';

$router = new \Bramus\Router\Router();

$router->set404(function() {
	header('HTTP/1.1 404 Not Found');
	require_once 'src/404.php';
});

$router->get('/', function() {
	require_once 'src/index.php';
});

$router->get('/guide', function() {
	require_once 'src/guide.php';
});

$router->get('/disclaimer', function() {
	require_once 'src/disclaimer.php';
});

$router->get('/contact', function() {
	require_once 'src/contact.php';
});

$router->get('/press', function() {
	require_once 'src/press.php';
});

$router->get('/statistics', function() {
	require_once 'src/statistics.php';
});

$router->get('/cookie-policy', function() {
	require_once 'src/cookie_policy.php';
});

$router->get('/arenas', function() {
	require_once 'src/arenas.php';
});

$router->get('/arenas/(\w+)', function($arena) {
	require_once 'src/arena.php';
});

$router->get('/download/(\w+)', function($arena) {
	require_once 'src/download.php';
});

$router->post('/upload', function() {
	require_once 'src/upload.php';
});

$router->get('/weapons', function() {
	require_once 'src/weapons.php';
});

$router->get('/arenas/(\w+)/{file}', function($arena, $file) {
	require_once 'src/file.php';
});

$router->get('/servers', function() {
	require_once 'src/servers.php';
});

$router->get('/servers/{address}', function($address) {
	require_once 'src/servers.php';
});

$router->get('/admin', function() {
	require_once 'src/admin/login.php';
});

$router->post('/admin', function() {
	require_once 'src/admin/login.php';
});

$router->get('/admin/visitors', function() {
	require_once 'src/admin/visitors.php';
});

$router->get('/admin/authorized-mappers', function() {
	require_once 'src/admin/authorized_mappers.php';
});

$router->get('/admin/logout', function() {
	require_once 'src/admin/logout.php';
});

$router->run();
