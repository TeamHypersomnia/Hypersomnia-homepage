<?php
// This script should be executed by crontab every 15 minutes
if (php_sapi_name() !== 'cli') {
	die('This script can only be run from the command line');
}

require_once('vendor/autoload.php');
require_once('src/config.php');
require_once('src/common.php');

$arr = request('https://api.github.com/repos/TeamHypersomnia/Hypersomnia/commits');

$commits = [];
foreach ($arr as $k => $v) {
	if (count($commits) >= 15) break;
	$commits[] = [
		'title' => cut_title($v['commit']['message'], 40),
		'url' => $v['html_url'],
		'date' => $v['commit']['author']['date']
	];
}

put_json('src/data/commits.json', $commits);
