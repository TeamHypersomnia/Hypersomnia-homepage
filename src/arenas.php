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
	$from_autosave = false;

	$autosave_path = "$arenas_path/$value/autosave.json";
	$json_path = "$arenas_path/$value/$value.json";

	$chosen_path = $json_path;

	if (file_exists($autosave_path)) {
		$chosen_path = $autosave_path;
		$from_autosave = true;
	}

	if (file_exists($chosen_path)) {
		$json = json_decode(file_get_contents($chosen_path), true);
		if (isset($json['about']['author'])) {
			$author = $json['about']['author'];
		}
		if (isset($json['about']['short_description'])) {
			$short_description = mb_strimwidth($json['about']['short_description'], 0, 50, '(...)');
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
		'version_timestamp' => $version_timestamp,
		'from_autosave' => $from_autosave
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
