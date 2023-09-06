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
$updated = time_elapsed($json['meta']['version_timestamp'] ?? '');
$author = $json['about']['author'] ?? 'N/A';
$short_description = $json['about']['short_description'] ?? 'N/A';
$full_description = $json['about']['full_description'] ?? 'N/A';
$resources = isset($json['external_resources']) ? count($json['external_resources']) : 0;
$size = format_size(directory_size("$arenas_path/$arena"));

echo $twig->render('arena.twig', [
	'url' => $url,
	'page' => $arena . ' - Arenas',
	'arena' => $arena,
	'prev' => $prev,
	'next' => $next,
	'updated' => $updated,
	'author' => $author,
	'short_description' => $short_description,
	'full_description' => $full_description,
	'resources' => $resources,
	'size' => $size
]);
