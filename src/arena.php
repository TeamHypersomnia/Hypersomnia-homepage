<?php
require_once('src/config.php');
require_once('src/common.php');
require_once('src/twig.php');

if (file_exists("$arenas_path/$arena") == false) {
	header("Location: {$url}arenas");
	die();
}

$arenas = [];
foreach(glob("$arenas_path/*", GLOB_ONLYDIR) as $dir) {
	$arenas[] = basename($dir);
}
$key = array_search($arena, $arenas);
$prev = ($key == 0) ? $arenas[sizeof($arenas) - 1] : $arenas[$key - 1];
$next = ($key == sizeof($arenas) - 1) ? $arenas[0] : $arenas[$key + 1];

$json = get_json("$arenas_path/$arena/$arena.json");
$version_timestamp = $json['meta']['version_timestamp'] ?? '';
$author = $json['about']['author'] ?? 'N/A';
$short_description = $json['about']['short_description'] ?? 'N/A';
$full_description = $json['about']['full_description'] ?? 'N/A';
$external_resources_num = sizeof($json['external_resources']) ?? 0;

echo $twig->render('arena.twig', [
	'url' => $url,
	'page' => $arena . ' - Arenas',
	'arena' => $arena,
	'next' => $next,
	'prev' => $prev,
	'version_timestamp' => time_elapsed($version_timestamp),
	'author' => $author,
	'short_description' => $short_description,
	'full_description' => $full_description,
	'external_resources_num' => $external_resources_num
]);
