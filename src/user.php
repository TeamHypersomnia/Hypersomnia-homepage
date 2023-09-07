<?php
session_start();

$visitors = get_json('src/data/visitors.json');
$visitors[$_SERVER['REMOTE_ADDR']] = [
	'ts' => time(),
	'ua' => $_SERVER['HTTP_USER_AGENT'],
	'uri' => $_SERVER['REQUEST_URI']
];
put_json('src/data/visitors.json', $visitors);

if (is_user_logged() == true) {
	$users = get_json('src/data/users.json');
	$id = $_SESSION['id'];
	$users[$id]['last_page'] = $_SERVER['REQUEST_URI'];
	$users[$id]['last_seen'] = time();
	put_json('src/data/users.json', $users);
}
