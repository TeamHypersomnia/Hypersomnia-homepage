<?php
require_once 'src/config.php';
require_once 'src/twig.php';

$statistics = [];
$content = @file_get_contents('src/data/statistics.json');
if ($content !== false) {
	$statistics = json_decode($content, true);
}
$statistics = array_slice($statistics, -5, null, true);
$days = array_keys($statistics);

echo $twig->render('statistics.twig', [
	'url' => $url,
	'page' => 'Statistics',
	'days' => $days,
	'statistics' => $statistics
]);
