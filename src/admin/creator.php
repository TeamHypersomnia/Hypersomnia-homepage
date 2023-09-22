<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';
require_once 'src/admin/permissions.php';

$creators = get_json($arenas_path.'/authorized_mappers.json');

$k = array_search($creator, array_column($creators, 'shorthand'));
if ($k === false) {
	header("Location: {$url}admin/creators");
	die();
}

$k = array_keys($creators)[$k];

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
	if (isset($_POST['delete']) && $_POST['delete'] == 'on') {
		unset($creators[$k]);
	} else {
		$arenas = explode(PHP_EOL, trim($_POST['arenas']));
		$creators[$k]['shorthand'] = $_POST['shorthand'];
		$creators[$k]['allow_creating_new'] = ($_POST['allow_creating_new'] === 'yes') ? true : false;
		$creators[$k]['maps'] = $arenas;
	}
	put_json("$arenas_path/authorized_mappers.json", $creators);
	header("Location: {$url}admin/creators");
	die();
}

echo $twig->render('admin/creator.twig', [
	'page' => 'Creators',
	'creator' => $creators[$k]
]);
