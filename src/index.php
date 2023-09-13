<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

$commits = $memcached->get('commits');
$commits = $commits ?? [];
foreach ($commits as $k => $v) {
	$commits[$k]['date'] = time_elapsed($v['date']);
}

echo $twig->render('index.twig', [
	's' => $_SESSION,
	'url' => $url,
	'page' => 'Index',
	'commits' => $commits
]);
