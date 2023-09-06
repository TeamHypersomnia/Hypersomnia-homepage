<?php
require_once 'src/config.php';
require_once 'src/twig.php';
require_once 'src/common.php';

session_start();

if (!isset($_SESSION['admin']) || $_SESSION['admin'] == false) {
	header("Location: {$url}admin");
	die();
}

$content = @file_get_contents('src/data/visitors.json');
if ($content == false) {
	$visitors = [];
} else {
	$visitors = json_decode($content, true);
}

uasort($visitors, function ($a, $b) {
	return $b['ts'] - $a['ts'];
});

foreach ($visitors as $key => $value) {
	$dateTime = new DateTime();
	$dateTime->setTimestamp($value['ts']);
	$visitors[$key]['ts'] = time_elapsed_string($dateTime->format('Y-m-d H:i:s'));
	$result = new WhichBrowser\Parser($value['ua']);
	$visitors[$key]['result'] = $result->toString();
}

echo $twig->render('admin/visitors.twig', [
	'url' => $url,
	'page' => 'Visitors',
	'visitors' => $visitors
]);
