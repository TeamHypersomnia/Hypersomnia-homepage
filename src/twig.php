<?php
require_once('src/ext/filemtime.php');

$loader = new \Twig\Loader\FilesystemLoader('templates');
$twig = new \Twig\Environment($loader, [
	'cache' => $cache
]);
$twig->addExtension(new \fileModificationTime\CustomTwigExtension());

$visitors = get_json('src/data/visitors.json');
$visitors[$_SERVER['REMOTE_ADDR']] = [
	'ts' => time(),
	'ua' => $_SERVER['HTTP_USER_AGENT'],
	'uri' => $_SERVER['REQUEST_URI']
];
put_json('src/data/visitors.json', $visitors);
