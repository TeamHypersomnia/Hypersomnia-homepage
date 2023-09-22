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

function random_string($length = 50) {
	$characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
	$randomString = '';
	for ($i = 0; $i < $length; $i++) {
		$randomString .= $characters[rand(0, strlen($characters) - 1)];
	}
	return $randomString;
}

$creators = get_json($arenas_path.'/authorized_mappers.json');
uasort($creators, fn($a, $b) => strcasecmp($a['shorthand'], $b['shorthand']));

if (isset($_POST['shorthand'])) {
	$shorthand = $_POST['shorthand'];
	$key = random_string(50);
	$creators[$key] = [
		'shorthand' => $shorthand,
		'allow_creating_new' => false,
		'maps' => []
	];
	put_json("$arenas_path/authorized_mappers.json", $creators);
	header("Location: {$url}admin/creators/{$shorthand}");
	die();
}

echo $twig->render('admin/creators.twig', [
	'page' => 'Creators',
	'creators' => $creators
]);
