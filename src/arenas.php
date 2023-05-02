<?php
require_once 'src/config.php';
require_once 'src/twig.php';

$maps = [];
$arenas = array_diff(scandir($arenas_path), array('..', '.'));
foreach ($arenas as $key => $value) {

	$miniature = false;
	$miniature_path = "$arenas_path/$value/miniature.png";
	if (file_exists($miniature_path)) {
		$type = pathinfo($miniature_path, PATHINFO_EXTENSION);
		$base64 = base64_encode(file_get_contents($miniature_path));
		$miniature = "data:image/$type;base64,$base64";
	}

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
		'miniature' => $miniature,
		'author' => $author,
		'short_description' => $short_description
	]);
}

echo $twig->render('arenas.twig', [
	'url' => $url,
	'page' => 'Arenas',
	'maps' => $maps
]);
