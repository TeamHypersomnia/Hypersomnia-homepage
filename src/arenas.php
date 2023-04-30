<?php
require_once 'src/config.php';
require_once 'src/twig.php';

$maps = [];
$arenas = array_diff(scandir($arenas_path), array('..', '.'));
foreach ($arenas as $key => $value) {
	$path = "$arenas_path/$value/$value.miniature.png";
	if (file_exists($path)) {
		$type = pathinfo($path, PATHINFO_EXTENSION);
		$base64 = base64_encode(file_get_contents($path));
		$miniature = "data:image/$type;base64,$base64";
	} else {
		$miniature = false;
	}
	array_push($maps, [
		'name' => $value,
		'miniature' => $miniature
	]);
}

echo $twig->render('arenas.twig', [
	'url' => $url,
	'page' => 'Arenas',
	'maps' => $maps
]);
