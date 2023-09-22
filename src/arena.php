<?php
require_once 'src/config.php';
require_once 'src/common.php';
require_once 'src/user.php';
require_once 'src/twig.php';

function directory_size($dir) {
	$size = 0;
	$files = glob(rtrim($dir, '/') . '/*');
	if ($files === false) {
		return false;
	}
	foreach ($files as $file) {
		if (is_file($file)) {
			$size += filesize($file);
		} elseif (is_dir($file)) {
			$size += directory_size($file);
		}
	}
	return $size;
}

$arenas = $memcached->get('arenas');
if (!$arenas) {
	$arenas = load_arenas($arenas_path, $memcached);
}

$arenas = array_column($arenas, 'name');
if (!in_array($arena, $arenas)) {
	header("Location: {$url}arenas");
	die();
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
$version_timestamp = $json['meta']['version_timestamp'];

// Likes
$likes = 0;
$is_liked = false;
$d = get_json("src/data/arenas/$arena.json");
if (isset($d['likes'])) {
	$likes = count($d['likes']);
	if (is_logged() && in_array($_SESSION['id'], $d['likes'])) {
		$is_liked = true;
	}
}

echo $twig->render('arena.twig', [
	'page' => $arena . ' - Arenas',
	'arena' => $arena,
	'prev' => $prev,
	'next' => $next,
	'updated' => $updated,
	'author' => $author,
	'short_description' => $short_description,
	'full_description' => $full_description,
	'resources' => $resources,
	'size' => $size,
	'likes' => $likes,
	'is_liked' => $is_liked,
	'version_timestamp' => $version_timestamp
]);
