<?php
require_once 'src/config.php';
require_once 'src/twig.php';

session_start();

if (!isset($_SESSION['admin']) || $_SESSION['admin'] == false) {
	header("Location: {$url}admin");
	die();
}

if ($cache != false) {
	$cache = realpath($cache);
}

function getLinuxDistroName() {
	$osReleaseFile = '/etc/os-release';
	if (file_exists($osReleaseFile)) {
		$lines = file($osReleaseFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
		foreach ($lines as $line) {
			if (strpos($line, 'PRETTY_NAME=') === 0) {
				$distroName = trim(str_replace('PRETTY_NAME=', '', $line), '"');
				return $distroName;
			}
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
	'apikey_github' => $apikey_github,
	'apikey_youtube' => $apikey_youtube,
	'user' => get_current_user(),
	'realpath' => realpath('.'),
	's' => php_uname('s'),
	'n' => php_uname('n'),
	'r' => php_uname('r'),
	'v' => php_uname('v'),
	'm' => php_uname('m'),
	'distro' => getLinuxDistroName()
]);
