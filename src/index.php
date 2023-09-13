<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

$commits = $memcached->get('commits');
if (!$commits) {
	$result = request('https://api.github.com/repos/TeamHypersomnia/Hypersomnia/commits');
	$commits = [];
	foreach (array_slice($result, 0, 15) as $k => $v) {
		$commits[] = [
			'sha' => $v['sha'],
			'date' => $v['commit']['author']['date'],
			'message' => cut_title($v['commit']['message'], 40)
		];
	}
	$memcached->set('commits', $commits, time() + 300);
}

foreach ($commits as $k => $v) {
	$commits[$k]['date'] = time_elapsed($v['date']);
}

echo $twig->render('index.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Index',
	'commits' => $commits
]);
