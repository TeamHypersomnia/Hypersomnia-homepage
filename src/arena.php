<?php
require_once 'src/config.php';
require_once 'src/twig.php';

if (file_exists("$arenas_path/$arena") == false) {
	header("Location: {$url}arenas");
	die();
}

function time_elapsed_string($datetime, $full = false) {
	$now = new DateTime;
	$then = new DateTime($datetime);
	$diff = (array)$now->diff($then);
	$diff['w']  = floor($diff['d'] / 7);
	$diff['d'] -= $diff['w'] * 7;
	$string = array(
		'y' => 'year',
		'm' => 'month',
		'w' => 'week',
		'd' => 'day',
		'h' => 'hour',
		'i' => 'minute',
		's' => 'second'
	);
	foreach($string as $k => & $v) {
		if ($diff[$k]) {
			$v = $diff[$k] . ' ' . $v .($diff[$k] > 1 ? 's' : '');
		} else {
			unset($string[$k]);
		}
	}
	if (!$full) $string = array_slice($string, 0, 1);
	return $string ? implode(', ', $string) . ' ago' : 'just now';
}

$version_timestamp = 0;
$author = 'Unknown';
$short_description = '';
$full_description = '';
$json_path = "$arenas_path/$arena/$arena.json";
if (file_exists($json_path)) {
	$json = json_decode(file_get_contents($json_path), true);
	if (isset($json['meta']['version_timestamp'])) {
		$version_timestamp = time_elapsed_string($json['meta']['version_timestamp']);
	}
	if (isset($json['about']['author'])) {
		$author = $json['about']['author'];
	}
	if (isset($json['about']['short_description'])) {
		$short_description = $json['about']['short_description'];
	}
	if (isset($json['about']['full_description'])) {
		$full_description = $json['about']['full_description'];
	}
}

echo $twig->render('arena.twig', [
	'url' => $url,
	'page' => $arena,
	'arena' => $arena,
	'version_timestamp' => $version_timestamp,
	'author' => $author,
	'short_description' => $short_description,
	'full_description' => $full_description
]);
