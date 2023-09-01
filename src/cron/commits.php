<?php
if (php_sapi_name() !== 'cli') {
	die("This script can only be run from the command line.");
}

require_once '../config.php';
require_once '../common.php';

$arr = request('https://api.github.com/repos/TeamHypersomnia/Hypersomnia/commits', [
	'Accept: application/vnd.github+json',
	'Authorization: Bearer ' . $apikey_github,
	'X-Github-Api-Version: 2022-11-28'
]);

$commits = [];
foreach ($arr as $key => $value) {
	if (sizeof($commits) == 15) {
		break;
	}
	array_push($commits, [
		'title' => cutTitle($value['commit']['message'], 69),
		'url' => $value['html_url'],
		'date' => $value['commit']['author']['date']
	]);
}
file_put_contents('../data/commits.json', json_encode($commits));
