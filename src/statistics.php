<?php
require_once 'src/config.php';
require_once 'src/twig.php';

$statistics = [];
$content = @file_get_contents('src/data/statistics.json');
if ($content !== false) {
	$statistics = json_decode($content, true);
	$statistics = array_slice($statistics, -5, null, true);
}

echo $twig->render('statistics.twig', [
	'url' => $url,
	'page' => 'Statistics',
	'statistics' => $statistics
]);
