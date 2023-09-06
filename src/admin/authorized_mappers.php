<?php
require_once('src/config.php');
require_once('src/common.php');
require_once('src/twig.php');

session_start();

if (!isset($_SESSION['admin']) || $_SESSION['admin'] == false) {
	header("Location: {$url}admin");
	die();
}

$mappers = get_json($arenas_path.'/authorized_mappers.json');
uasort($mappers, fn($a, $b) => strcasecmp($a['shorthand'], $b['shorthand']));

echo $twig->render('admin/authorized_mappers.twig', [
	'url' => $url,
	'page' => 'Authorized Mappers',
	'mappers' => $mappers
]);
