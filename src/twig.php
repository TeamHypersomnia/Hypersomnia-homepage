<?php
require_once 'src/ext/filemtime.php';
require_once 'src/ext/minify.php';

$loader = new \Twig\Loader\FilesystemLoader('templates');
$twig = new CustomTwigEnvironment($loader, ['cache' => $cache]);
$twig->addExtension(new \fileModificationTime\CustomTwigExtension());

if (!is_logged()) {
	$_SESSION['redirect'] = $uri;
}
