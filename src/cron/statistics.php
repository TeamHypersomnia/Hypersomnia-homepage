<?php
// This script should be executed by crontab at the end of the day
if (php_sapi_name() !== 'cli') {
	die('This script can only be run from the command line');
}

require_once('../config.php');
require_once('../common.php');

$statistics = get_json('../data/statistics.json');
$date = date("d.m.Y");
if (isset($statistics[$date]) == false) {
	$statistics[$date] = [];
}

if (class_exists('Memcached')) {
	$memcached = new Memcached();
	$memcached->addServer('127.0.0.1', 11211);
	$visitors = $memcached->get('visitors');
	$visitors = $visitors ? json_decode($visitors, true) : [];
	$statistics[$date]['unique_visitors'] = count($visitors);
	$memcached->delete('visitors');
}

$json = request('https://api.github.com/repos/TeamHypersomnia/Hypersomnia');
$statistics[$date]['github_stars'] = intval($json['stargazers_count']);
$statistics[$date]['github_forks'] = intval($json['forks']);

if (empty($apikey_youtube) == false) {
	$json = request('https://www.googleapis.com/youtube/v3/channels?part=statistics&id=UC4ZChoPA5sx6Z41rfaTG9bQ&key=' . $apikey_youtube);
	$statistics[$date]['youtube_views'] = intval($json['items'][0]['statistics']['viewCount']);
	$statistics[$date]['youtube_subscribers'] = intval($json['items'][0]['statistics']['videoCount']);
}

$statistics[$date]['hypersomnia_arenas'] = count(request('https://hypersomnia.xyz/arenas?format=json'));
$statistics[$date]['hypersomnia_servers'] = count(request('http://hypersomnia.xyz:8420/server_list_json'));

put_json('../data/statistics.json', $statistics);
