<?php
require_once('src/config.php');
require_once('src/common.php');
require_once('src/twig.php');

session_start();

if (is_admin_logged() == false) {
	header("Location: {$url}admin");
	die();
}

if ($cache != false) {
	$cache = realpath($cache);
}

function get_distro() {
	$filepath = '/etc/os-release';
	if (file_exists($filepath) == false) {
		return false;
	}
	$lines = file($filepath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
	foreach ($lines as $line) {
		if (strpos($line, 'PRETTY_NAME=') === 0) {
			return trim(str_replace('PRETTY_NAME=', '', $line), '"');
		}
	}
	return false;
}

echo $twig->render('admin/system.twig', [
	'url' => $url,
	'page' => 'System',
	'phpversion' => phpversion(),
	'cache' => $cache,
	'arenas_path' => $arenas_path,
	'user' => get_current_user(),
	'realpath' => realpath('.'),
	's' => php_uname('s'),
	'n' => php_uname('n'),
	'r' => php_uname('r'),
	'v' => php_uname('v'),
	'm' => php_uname('m'),
	'distro' => get_distro()
]);
