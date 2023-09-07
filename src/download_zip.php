<?php
require_once 'src/config.php';
require_once 'src/common.php';

if (file_exists("$arenas_path/$arena") == false) {
	header("Location: {$url}arenas");
	die();
}

$json_path = "$arenas_path/$arena/$arena.json";
if (file_exists($json_path)) {
	$json = json_decode(file_get_contents($json_path), true);
	if (isset($json['meta']['version_timestamp'])) {
		$name = "$arena-" . strtotime($json['meta']['version_timestamp']);
	} else {
		$name = $arena;
	}
} else {
	$name = $arena;
}

if (file_exists("cache/$name.zip") == false) {
	zip("$arenas_path/$arena", "cache/$name.zip", true);
}

header("Content-type: application/zip"); 
header("Content-Disposition: attachment; filename=$arena.zip");
header("Content-length: " . filesize("cache/$name.zip"));
header("Pragma: no-cache"); 
header("Expires: 0"); 
readfile("cache/$name.zip");
