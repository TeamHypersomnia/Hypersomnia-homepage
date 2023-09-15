<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

if (is_admin($admins) == false) {
	require_once 'src/404.php';
	die();
}

$creators = get_json($arenas_path.'/authorized_mappers.json');
uasort($creators, fn($a, $b) => strcasecmp($a['shorthand'], $b['shorthand']));

if (isset($_POST['shorthand'])) {
	$key = random_string(50);
	$creators[$key] = [
		'shorthand' => $_POST['shorthand'],
		'allow_creating_new' => false,
		'maps' => []
	];
	put_json($arenas_path . '/authorized_mappers.json', $creators);
}

echo $twig->render('admin/creators.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Creators',
	'creators' => $creators
]);
