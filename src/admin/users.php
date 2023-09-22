<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

if (is_logged() == false) {
	require_once 'src/discord.php';
	die();
}

if (is_admin($admins) == false) {
	require_once 'src/403.php';
	die();
}

$users = get_json('src/data/users.json');
uasort($users, fn($a, $b) => $b['last_login'] - $a['last_login']);
foreach ($users as $k => $v) {
	$users[$k]['last_login'] = time_elapsed($dt->setTimestamp($v['last_login'])->format('Y-m-d H:i:s'));
}

echo $twig->render('admin/users.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Users',
	'users' => $users
]);
