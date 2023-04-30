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

$router->get('/arenas', function() {
	require_once 'src/arenas.php';
});

$router->get('/arenas/(\w+)', function($arena) {
	require_once 'src/arena.php';
});

$router->get('/weapons', function() {
	require_once 'src/weapons.php';
});

$router->run();
