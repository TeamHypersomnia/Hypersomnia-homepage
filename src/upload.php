<?php
require_once 'src/config.php';
require_once 'src/common.php';

function ensurePathExists($path) {
	$path = dirname($path);
	$directories = explode('/', $path);
	$currentPath = '';
	foreach ($directories as $directory) {
		$currentPath .= $directory . '/';
		if (!is_dir($currentPath)) {
			mkdir($currentPath, 0777);
		}
	}
}

header('Content-type: application/json; charset=utf-8');

if (!isset($_POST['apikey']) || !isset($_POST['arena']) || !isset($_POST['filename'])) {
	error('Missing required parameters');
}

$apikey = $_POST['apikey'];
$arena = $_POST['arena'];
$filename = $_POST['filename'];

$authorized_mappers = get_json($arenas_path . '/authorized_mappers.json');
if (!isset($authorized_mappers[$apikey])) {
	error('You are not authorized to upload maps');
}

$allow_creating_new = false;
if (isset($authorized_mappers[$apikey]['allow_creating_new'])) {
	if ($authorized_mappers[$apikey]['allow_creating_new'] == 1) {
		$allow_creating_new = true;
	}
}

$arenas = [];
if (isset($authorized_mappers[$apikey]['maps'])) {
	$arenas = $authorized_mappers[$apikey]['maps'];
}
if ($allow_creating_new == false && in_array($arena, $arenas) == false) {
	error('You are not authorized to create new maps');
} elseif ($allow_creating_new == true) {
	foreach ($authorized_mappers as $key => $value) {
		if (in_array($arena, $value['maps'])) {
			$owner = $key;
		}
	}
	if (isset($owner) && $owner != $apikey) {
		error('You are not authorized to upload map with this name');
	}
}

$allowed = ['json', 'png', 'jpg', 'gif', 'ogg', 'wav'];
$ext = pathinfo($_FILES['upload']['name'], PATHINFO_EXTENSION);
$ext2 = pathinfo($filename, PATHINFO_EXTENSION);
if (!in_array($ext, $allowed) || !in_array($ext2, $allowed)) {
	error('You are not allowed to upload this file type');
}

// To prevent the use of .. or . in file paths and avoid directory traversal attacks
$filename = str_replace('\\', '/', $filename);
$pathComponents = explode('/', $filename);
foreach ($pathComponents as $component) {
	if ($component === '.' || $component === '..') {
		error('Parameter filename is invalid');
	}
}

$desiredPath = "$arenas_path/$arena/$filename";
ensurePathExists($desiredPath);
move_uploaded_file($_FILES['upload']['tmp_name'], $desiredPath);

// Refresh the cache when a new arena is uploaded
if ($filename == "$arena.json") {
	load_arenas($arenas_path, $memcached);
	if (!in_array($arena, $authorized_mappers[$apikey]['maps'])) {
		$authorized_mappers[$apikey]['maps'][] = $arena;
		put_json("$arenas_path/authorized_mappers.json", $authorized_mappers);
	}
}

success('The file has been uploaded');
