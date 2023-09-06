<?php
require_once('src/config.php');
require_once('src/common.php');
require_once('src/twig.php');

$statistics = get_json('src/data/statistics.json');
$statistics = array_slice($statistics, -5, null, true);

echo $twig->render('statistics.twig', [
	'url' => $url,
	'page' => 'Statistics',
	'statistics' => $statistics
]);
