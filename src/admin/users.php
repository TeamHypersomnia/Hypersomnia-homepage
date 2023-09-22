<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';
require_once 'src/admin/permissions.php';

$users = get_json('src/data/users.json');
uasort($users, fn($a, $b) => $b['last_login'] - $a['last_login']);
foreach ($users as $k => $v) {
	$users[$k]['last_login'] = time_elapsed($dt->setTimestamp($v['last_login'])->format('Y-m-d H:i:s'));
}

echo $twig->render('admin/users.twig', [
	'page' => 'Users',
	'users' => $users
]);
