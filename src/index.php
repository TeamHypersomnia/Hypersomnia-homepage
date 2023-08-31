<?php
require_once 'src/config.php';
require_once 'src/twig.php';
require_once 'src/common.php';

$content = @file_get_contents('src/data/commits.json');
if ($content == false) {
	$commits = [];
} else {
	$commits = json_decode($content, true);
	foreach ($commits as $key => $value) {
		$commits[$key]['date'] = time_elapsed_string($value['date']);
	}
}

echo $twig->render('index.twig', [
	'url' => $url,
	'page' => 'Index',
	'commits' => $commits
]);
