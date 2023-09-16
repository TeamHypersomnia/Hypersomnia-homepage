<?php
// This script should be executed by crontab every 5 minutes
if (php_sapi_name() !== 'cli') {
	die('This script can only be run from the command line');
}

require_once('vendor/autoload.php');
require_once('src/config.php');
require_once('src/common.php');

$result = request('https://api.github.com/repos/TeamHypersomnia/Hypersomnia/commits');
$commits = [];
foreach (array_slice($result, 0, 10) as $k => $v) {
    $commits[] = [
        'sha' => $v['sha'],
        'date' => $v['commit']['author']['date'],
        'message' => cut_title($v['commit']['message'], 35)
    ];
}
$memcached->set('commits', $commits);
