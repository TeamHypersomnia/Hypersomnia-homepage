<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

if (is_admin($admins) == false) {
	require_once 'src/404.php';
	die();
}

if ($_SERVER['REQUEST_METHOD'] == 'POST' && isset($_POST['key'])) {
	switch ($_POST['key']) {
		case 'arenas':
			load_arenas($arenas_path, $memcached);
			break;
		case 'commits':
			$memcached->delete('commits');
			break;
		case 'visitors':
			$memcached->delete('visitors');
			break;
		case 'weapons':
			$memcached->delete('weapons');
			break;
		default:
			break;
	}
}

echo $twig->render('admin/cache.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Cache'
]);
