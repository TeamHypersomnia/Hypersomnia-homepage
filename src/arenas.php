<?php
require_once 'src/config.php';
require_once 'src/twig.php';

$maps = [];
$arenas = array_diff(scandir($arenas_path), array('..', '.'));
foreach ($arenas as $key => $value) {
	$author = 'Unknown';
	$short_description = '';
	$json_path = "$arenas_path/$value/$value.json";
	if (file_exists($json_path)) {
		$json = json_decode(file_get_contents($json_path), true);
		if (isset($json['about']['author'])) {
			$author = $json['about']['author'];
		}
		if (isset($json['about']['short_description'])) {
			$short_description = mb_strimwidth($json['about']['short_description'], 0, 50, '(...)');
		}
	}

	array_push($maps, [
		'name' => $value,
		'author' => $author,
		'short_description' => $short_description
	]);
}

if (isset($_GET['format']) && $_GET['format'] == 'json') {
	print(json_encode($maps));
	exit();
}

echo $twig->render('arenas.twig', [
	'url' => $url,
	'page' => 'Arenas',
	'maps' => $maps
]);
