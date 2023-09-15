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

$k = array_search($creator, array_column($creators, 'shorthand'));
if ($k === false) {
	header("Location: {$url}admin/creators");
	die();
}

$k = array_keys($creators)[$k];

if (isset($_POST['delete']) && $_POST['delete'] == 'on') {
	unset($creators[$k]);
	put_json($arenas_path . '/authorized_mappers.json', $creators);
	header("Location: {$url}admin/creators");
	die();
} elseif (isset($_POST['shorthand']) && isset($_POST['arenas'])) {
	$arenas = explode(PHP_EOL, trim($_POST['arenas']));
	$creators[$k]['shorthand'] = $_POST['shorthand'];
	$creators[$k]['maps'] = $arenas;
	put_json($arenas_path . '/authorized_mappers.json', $creators);
}

echo $twig->render('admin/creator.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Creators',
	'creator' => $creators[$k]
]);
