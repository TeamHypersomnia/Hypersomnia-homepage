<?php
require_once 'src/config.php';
require_once 'src/twig.php';

$statistics = json_decode(file_get_contents('src/data/statistics.json'), true);
$statistics = array_slice($statistics, -5, null, true);
$days = array_keys($statistics);

echo $twig->render('statistics.twig', [
	'url' => $url,
	'page' => 'Statistics',
	'days' => $days,
	'statistics' => $statistics
]);
