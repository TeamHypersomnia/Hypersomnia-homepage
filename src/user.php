<?php
session_start();

$ip = $_SERVER['REMOTE_ADDR'];
$ts = time();
$ua = $_SERVER['HTTP_USER_AGENT'];
$uri = $_SERVER['REQUEST_URI'];

$visitors = get_json('src/data/visitors.json');
$visitors[$ip] = [
	'ts' => $ts,
	'ua' => $ua,
	'uri' => $uri
];
put_json('src/data/visitors.json', $visitors);

if (is_logged()) {
	$users = get_json('src/data/users.json');
	$id = $_SESSION['id'];
	$users[$id]['last_page'] = $uri;
	$users[$id]['last_seen'] = $ts;
	put_json('src/data/users.json', $users);
} else {
	if (!preg_match("/discord/i", $uri)) {
		$_SESSION['redirect'] = $uri;
	}
}
