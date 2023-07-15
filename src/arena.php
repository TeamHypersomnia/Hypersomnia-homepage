<?php
require_once 'src/config.php';
require_once 'src/twig.php';
require_once 'src/common.php';

if (file_exists("$arenas_path/$arena") == false) {
	header("Location: {$url}arenas");
	die();
}

$arenas = array();
foreach(glob("$arenas_path/*", GLOB_ONLYDIR) as $dir) {
	array_push($arenas, basename($dir));
}
$key = array_search($arena, $arenas);
if ($key == 0) {
	$prev = $arenas[sizeof($arenas)-1];
} else {
	$prev = $arenas[$key - 1];
}
if ($key == sizeof($arenas) - 1) {
	$next = $arenas[0];
} else {
	$next = $arenas[$key + 1];
}

$version_timestamp = 0;
$author = 'Unknown';
$short_description = 'N/A';
$full_description = 'N/A';
$external_resources_num = 0;

$json_path = "$arenas_path/$arena/$arena.json";
$autosave_path = "$arenas_path/$arena/autosave.json";

$chosen_path = $json_path;

if (file_exists($autosave_path)) {
	$chosen_path = $autosave_path;
}

if (file_exists($chosen_path)) {
	$json = json_decode(file_get_contents($chosen_path), true);
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
	if (isset($json['external_resources'])) {
		$external_resources_num = sizeof($json['external_resources']);
	}
}

echo $twig->render('arena.twig', [
	'url' => $url,
	'page' => $arena . ' - Arenas',
	'arena' => $arena,
	'version_timestamp' => $version_timestamp,
	'author' => $author,
	'short_description' => $short_description,
	'full_description' => $full_description,
	'next' => $next,
	'prev' => $prev,
	'external_resources_num' => $external_resources_num
]);
