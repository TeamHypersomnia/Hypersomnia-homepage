<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

$arenas = $memcached->get('arenas');
if (!$arenas) {
	$arenas = load_arenas($arenas_path, $memcached);
}

if (isset($_GET['author'])) {
	$arenas = array_filter($arenas, function ($v) {
		return $v['author'] === $_GET['author'];
	});
}

if (isset($_GET['format']) && $_GET['format'] == 'json') {
	header('Content-type: application/json; charset=utf-8');
	die(json_encode($arenas));
}

if (isset($_GET['version'])) {
	$key = array_search($_GET['version'], array_column($arenas, 'name'));
	if ($key !== false) {
		header('Content-type: text/plain; charset=utf-8');
		die($arenas[$key]['version_timestamp']);
	}
}

echo $twig->render('arenas.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Arenas',
	'arenas' => $arenas
]);
