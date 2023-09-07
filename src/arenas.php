<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

$arenas = [];
if (is_dir($arenas_path)) {
	$folders = array_diff(scandir($arenas_path), array('..', '.'));
	foreach ($folders as $k => $v) {
		if (is_dir("$arenas_path/$v") == false) {
			continue;
		}
		$json = get_json("$arenas_path/$v/$v.json");
		$version_timestamp = $json['meta']['version_timestamp'] ?? '';
		$author = $json['about']['author'] ?? 'N/A';
		$short_description = $json['about']['short_description'] ?? 'N/A';
		$arenas[] = [
			'name' => $v,
			'version_timestamp' => $version_timestamp,
			'author' => $author,
			'short_description' => $short_description
		];
	}
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
