<?php
require_once 'src/ext/filemtime.php';

$loader = new \Twig\Loader\FilesystemLoader('templates');
$twig = new \Twig\Environment($loader, [
	'cache' => $cache
]);
$twig->addExtension(new \fileModificationTime\CustomTwigExtension());
