<?php
require_once 'src/config.php';
require_once 'src/twig.php';

$maps = [];
$versions = [];

$arenas = array_diff(scandir($arenas_path), array('..', '.'));
foreach ($arenas as $key => $value) {
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
			$versions[$value] = $version_timestamp;
		}
	}

	array_push($maps, [
		'name' => $value,
		'author' => $author,
		'short_description' => $short_description,
		'version_timestamp' => $version_timestamp
	]);
}

if (isset($_GET['format']) && $_GET['format'] == 'json') {
	print(json_encode($maps));
	exit();
}

if (isset($_GET['version']) && isset($versions[$_GET['version']])) {
	print($versions[$_GET['version']]);
	exit();
}

echo $twig->render('arenas.twig', [
	'url' => $url,
	'page' => 'Arenas',
	'maps' => $maps
]);
