<?php
require_once 'src/filemtime.php';

$loader = new \Twig\Loader\FilesystemLoader('templates');
$twig = new \Twig\Environment($loader, [
	'cache' => $cache
]);
$twig->addExtension(new \fileModificationTime\CustomTwigExtension());

$visitors = [];
$content = @file_get_contents('src/data/visitors.json');
if ($content !== false) {
	$visitors = json_decode($content, true);
}

$ip = $_SERVER['REMOTE_ADDR'];
$visitors[$ip] = [
	'ts' => time(),
	'ua' => $_SERVER['HTTP_USER_AGENT'],
	'uri' => $_SERVER['REQUEST_URI']
];

file_put_contents('src/data/visitors.json', json_encode($visitors));
