<?php
require_once 'src/config.php';
require_once 'src/twig.php';

session_start();

if (!isset($_SESSION['admin']) || $_SESSION['admin'] == false) {
	header("Location: {$url}admin/login");
	die();
}

if ($cache != false) {
	$cache = realpath($cache);
}

echo $twig->render('admin/system.twig', [
	'url' => $url,
	'page' => 'System',
    'phpversion' => phpversion(),
	'php_uname' => php_uname(),
	'cache' => $cache,
	'arenas_path' => $arenas_path,
	'apikey_github' => $apikey_github,
	'apikey_youtube' => $apikey_youtube,
	'user' => get_current_user(),
	'realpath' => realpath('.')
]);
