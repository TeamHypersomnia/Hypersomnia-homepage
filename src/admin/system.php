<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';
require_once 'src/admin/permissions.php';

function get_distro() {
	$filepath = '/etc/os-release';
	if (!file_exists($filepath)) {
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

function system_uptime() {
	$filepath = '/proc/uptime';
	if (!file_exists($filepath)) {
		return false;
	}
	$contents = file_get_contents($filepath);
	if (!$contents) {
		return false;
	}
	return intval(explode(' ', $contents)[0]);
}

if (isset($packages)) {
	$packages = [];
	$require = get_json('composer.json')['require'];
	$composer = get_json('composer.lock');
	foreach ($composer['packages'] as $k => $v) {
		$name = $v['name'];
		if (!isset($require[$name])) {
			continue;
		}
		$d = request("https://repo.packagist.org/p2/{$name}.json");
		$packages[] = [
			'name' => $name,
			'version' => $v['version'],
			'url' => $d['packages'][$name][0]['source']['url'],
			'latest' => $d['packages'][$name][0]['version']
		];
	}
	echo $twig->render('admin/packages.twig', [
		'page' => 'System',
		'packages' => $packages
	]);
	exit();
}

$web_server = isset($_SERVER['SERVER_SOFTWARE']) ? $_SERVER['SERVER_SOFTWARE'] : 'Unknown';
if ($cache !== false) $cache = realpath($cache);
echo $twig->render('admin/system.twig', [
	'page' => 'System',
	'phpversion' => phpversion(),
	'cache' => $cache,
	'arenas_path' => $arenas_path,
	'user' => get_current_user(),
	'realpath' => realpath('.'),
	'operating_system' => php_uname('s') . ' ' . php_uname('m'),
	'host_name' => php_uname('n'),
	'release_name' => php_uname('r'),
	'distro' => get_distro(),
	'inipath' => php_ini_loaded_file(),
	'loadavg' => sys_getloadavg(),
	'system_uptime' => seconds_to_hhmmss(system_uptime()),
	'web_server' => $web_server
]);
