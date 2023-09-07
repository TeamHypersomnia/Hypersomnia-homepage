<?php
session_start();

$visitors = get_json('src/data/visitors.json');
$visitors[$_SERVER['REMOTE_ADDR']] = [
	'ts' => time(),
	'ua' => $_SERVER['HTTP_USER_AGENT'],
	'uri' => $_SERVER['REQUEST_URI']
];
put_json('src/data/visitors.json', $visitors);
