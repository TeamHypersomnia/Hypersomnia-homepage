<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';
require_once 'src/admin/permissions.php';

if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['key'])) {
	$memcached->delete($_POST['key']);
}

$stats = $memcached->getStats()[$memcached_host . ':' . $memcached_port];
echo $twig->render('admin/cache.twig', [
	'page' => 'Cache',
	'memcached_uptime' => seconds_to_hhmmss($stats['uptime']),
	'memcached_version' => $stats['version'],
	'memcached_bytes' => format_size($stats['bytes'])
]);
