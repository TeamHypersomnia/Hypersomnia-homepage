<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';
require_once 'src/admin/permissions.php';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
	$alert = isset($_POST['alert']) ? $_POST['alert'] : '';
	if (empty($alert)) {
		$memcached->delete('alert');
	} else {
		$memcached->set('alert', $alert);
	}
}

echo $twig->render('admin/settings.twig', [
	'page' => 'Settings',
	'alert' => $alert
]);
