<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

if (is_admin_logged() == false) {
	header("Location: {$url}admin");
	die();
}

$mappers = get_json($arenas_path.'/authorized_mappers.json');
uasort($mappers, fn($a, $b) => strcasecmp($a['shorthand'], $b['shorthand']));

echo $twig->render('admin/authorized_mappers.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Authorized Mappers',
	'mappers' => $mappers
]);
