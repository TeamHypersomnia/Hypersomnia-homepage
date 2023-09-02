<?php
$loader = new \Twig\Loader\FilesystemLoader('templates');
$twig = new \Twig\Environment($loader, [
	'cache' => $cache
]);

$content = @file_get_contents('src/data/visitors.json');
if ($content == false) {
	$visitors = [];
} else {
	$visitors = json_decode($content, true);
}

$ip = $_SERVER['REMOTE_ADDR'];
$time = date('H:i:s');
$user_agent = $_SERVER['HTTP_USER_AGENT'];
$request_uri = $_SERVER['REQUEST_URI'];
$visitors[$ip] = [$time, $user_agent, $request_uri];

file_put_contents('src/data/visitors.json', json_encode($visitors));
