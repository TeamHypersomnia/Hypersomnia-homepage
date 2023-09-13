<?php
session_start();

$ip = $_SERVER['REMOTE_ADDR'];
$ts = time();
$ua = isset($_SERVER['HTTP_USER_AGENT']) ? $_SERVER['HTTP_USER_AGENT'] : '';
$uri = $_SERVER['REQUEST_URI'];

$visitors = $memcached->get('visitors');
$visitors = $visitors ? json_decode($visitors, true) : [];
$visitors[$ip] = ['ts' => $ts, 'ua' => $ua, 'uri' => $uri];
$memcached->set('visitors', json_encode($visitors));

if (is_logged()) {
	$users = get_json('src/data/users.json');
	$id = $_SESSION['id'];
	$users[$id]['last_page'] = $uri;
	$users[$id]['last_seen'] = $ts;
	put_json('src/data/users.json', $users);
}
