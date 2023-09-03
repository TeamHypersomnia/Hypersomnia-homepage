<?php
require_once 'src/config.php';
require_once 'src/twig.php';

session_start();

if (!isset($_SESSION['admin']) || $_SESSION['admin'] == false) {
	header("Location: {$url}admin/login");
	die();
}

$content = @file_get_contents('src/data/authorized_mappers.json');
if ($content == false) {
	$authorized_mappers = [];
} else {
	$authorized_mappers = json_decode($content, true);
}

uasort($authorized_mappers, function ($a, $b) {
	return strcasecmp($a['shorthand'], $b['shorthand']);
});

echo $twig->render('admin/authorized_mappers.twig', [
	'url' => $url,
	'page' => 'Authorized Mappers',
	'authorized_mappers' => $authorized_mappers
]);
