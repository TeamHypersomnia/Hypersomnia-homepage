<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

if (is_admin_logged() == false) {
	header("Location: {$url}admin");
	die();
}

$users = get_json('src/data/users.json');
array_multisort(array_column($visitors, 'ts'), SORT_DESC, $visitors);

foreach ($users as $k => $v) {
	$dt = new DateTime();
	$users[$k]['last_login'] = time_elapsed($dt->setTimestamp($v['last_login'])->format('Y-m-d H:i:s'));
    $users[$k]['last_seen'] = time_elapsed($dt->setTimestamp($v['last_seen'])->format('Y-m-d H:i:s'));
}

echo $twig->render('admin/users.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Users',
	'users' => $users
]);
