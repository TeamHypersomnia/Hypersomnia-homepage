<?php
require_once 'src/config.php';
require_once 'src/common.php';

$files = [
	'windows' => 'https://hypersomnia.xyz/builds/latest/Hypersomnia-for-Windows.zip',
	'linux' => 'https://hypersomnia.xyz/builds/latest/Hypersomnia.AppImage',
	'macos' => 'https://hypersomnia.xyz/builds/latest/Hypersomnia-for-MacOS.dmg'
];

if (!isset($files[$file])) {
	require_once('src/404.php');
	die();
}

$download = get_json('src/data/download.json');
if (!isset($download[$file])) {
	$download[$file] = [];
}
$ip = $_SERVER['REMOTE_ADDR'];
if (!in_array($ip, $download[$file])) {
	$download[$file][] = $ip;
}
put_json('src/data/download.json', $download);

header("Location: {$files[$file]}");
die();
