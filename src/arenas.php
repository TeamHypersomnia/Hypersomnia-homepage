<?php
require_once 'src/config.php';
require_once 'src/twig.php';

$arenas = [];
$folders = array_diff(scandir($arenas_path), array('..', '.'));
foreach ($folders as $key => $value) {
	if (is_dir("$arenas_path/$value") == false) {
		continue;
	}
	$author = 'Unknown';
	$short_description = '';
	$version_timestamp = '';
	$json_path = "$arenas_path/$value/$value.json";

	if (file_exists($json_path)) {
		$json = json_decode(file_get_contents($json_path), true);
		if (isset($json['about']['author'])) {
			$author = $json['about']['author'];
		}
		if (isset($json['about']['short_description'])) {
			$short_description = $json['about']['short_description'];
		}
		if (isset($json['meta']['version_timestamp'])) {
			$version_timestamp = $json['meta']['version_timestamp'];
		}
	}

	$arenas[] = [
		'name' => $value,
		'author' => $author,
		'short_description' => $short_description,
		'version_timestamp' => $version_timestamp
	];
}

if (isset($_GET['format']) && $_GET['format'] == 'json') {
	header('Access-Control-Allow-Origin: *');
	header('Content-type: application/json; charset=utf-8');
	die(json_encode($arenas, JSON_PRETTY_PRINT));
}

if (isset($_GET['version'])) {
	$key = array_search($_GET['version'], array_column($arenas, 'name'));
	if ($key !== false) {
		header('Access-Control-Allow-Origin: *');
		header('Content-type: text/plain; charset=utf-8');
		die($arenas[$key]['version_timestamp']);
	}
}

echo $twig->render('arenas.twig', [
	'url' => $url,
	'page' => 'Arenas',
	'arenas' => $arenas
]);
