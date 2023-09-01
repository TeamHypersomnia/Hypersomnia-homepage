<?php
if (php_sapi_name() !== 'cli') {
	die("This script can only be run from the command line.");
}

require_once '../config.php';
require_once '../common.php';

$content = @file_get_contents('../data/statistics.json');
if ($content == false) {
	$statistics = [];
} else {
	$statistics = json_decode($content, true);
}

$date = date("d.m.Y");
if (isset($statistics[$date]) == false) {
    $statistics[$date] = [];
}

if (empty($apikey_github) == false) {
	$json = request('https://api.github.com/repos/TeamHypersomnia/Hypersomnia', [
		'Accept: application/vnd.github+json',
		'Authorization: Bearer ' . $apikey_github,
		'X-Github-Api-Version: 2022-11-28'
	]);
	$statistics[$date]['github_stars'] = intval($json['stargazers_count']);
	$statistics[$date]['github_forks'] = intval($json['forks']);
}

if (empty($apikey_youtube) == false) {
	$json = request('https://www.googleapis.com/youtube/v3/channels?part=statistics&id=UC4ZChoPA5sx6Z41rfaTG9bQ&key=' . $apikey_youtube);
	$statistics[$date]['youtube_views'] = intval($json['items'][0]['statistics']['viewCount']);
	$statistics[$date]['youtube_subscribers'] = intval($json['items'][0]['statistics']['videoCount']);
}

$json = request('https://hypersomnia.xyz/arenas?format=json');
$statistics[$date]['hypersomnia_arenas'] = sizeof($json);
$json = request('http://hypersomnia.xyz:8420/server_list_json');
$statistics[$date]['hypersomnia_servers'] = sizeof($json);

file_put_contents('../data/statistics.json', json_encode($statistics));
