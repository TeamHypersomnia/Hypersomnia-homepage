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
foreach ($statistics as $key => $value) {
	$unique_visitors[] = @$value['unique_visitors'];
	$github_stars[] = @$value['github_stars'];
	$github_forks[] = @$value['github_forks'];
	$youtube_views[] = @$value['youtube_views'];
	$youtube_subscribers[] = @$value['youtube_subscribers'];
	$hypersomnia_arenas[] = @$value['hypersomnia_arenas'];
	$hypersomnia_servers[] = @$value['hypersomnia_servers'];
}

echo $twig->render('statistics.twig', [
	'url' => $url,
	'page' => 'Statistics',
	'days' => $days,
	'statistics' => $statistics,
	'unique_visitors' => $unique_visitors,
	'github_stars' => $github_stars,
	'github_forks' => $github_forks,
	'youtube_views' => $youtube_views,
	'youtube_subscribers' => $youtube_subscribers,
	'hypersomnia_arenas' => $hypersomnia_arenas,
	'hypersomnia_servers' => $hypersomnia_servers
]);
